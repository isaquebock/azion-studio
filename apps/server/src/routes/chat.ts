import type { Request, Response } from "express";
import {
  chat,
  chatParamsFromRequestBody,
  maxIterations,
  toolDefinition,
  toServerSentEventsResponse,
} from "@tanstack/ai";
import type { JSONSchema } from "@tanstack/ai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import { env } from "../env.js";
import { callToolOneShot, getTools } from "../mcp-tools.js";

const SYSTEM_PROMPT = `Você é um assistente especializado na plataforma Azion Edge Computing.

Você tem acesso a tools para gerenciar todos os recursos da conta Azion do usuário:
edge applications, edge functions, workloads (o recurso que era chamado "domain"
até a API v3), rules engine, edge storage, WAF, real-time logs e marketplace.

IMPORTANTE — nomes de tools:
- TODAS as tools começam com o prefixo "azion_". Exemplos: azion_list_applications,
  azion_get_application, azion_create_workload, azion_list_functions.
- NUNCA invente nomes nem omita o prefixo. Use exatamente o nome que aparece no catálogo
  de tools fornecido — qualquer variação (sem "azion_", em camelCase, com pontos) falha.
- Se não tiver certeza do nome exato, escolha a tool mais próxima do catálogo em vez
  de adivinhar.
- Vocabulário: quando o usuário falar "domain", "domínio" ou "domínios", interprete como
  "workload" e use as tools azion_*_workload. Quando falar "DNS zone" ou "zona DNS", use
  azion_list_dns_zones.

Diretrizes:
- Sempre confirme o que foi executado após uma operação bem-sucedida.
- Para operações destrutivas (deletar/remover), peça confirmação ANTES de chamar a tool.
- Para operações de criação/atualização, NÃO peça confirmação se o usuário já forneceu os
  dados necessários — execute direto.
- Quando listar recursos, formate a saída de forma legível (tabelas ou listas Markdown).
- Se uma operação falhar, explique o erro em linguagem simples e sugira correções.
- Se o usuário pedir algo ambíguo, faça a pergunta mais relevante antes de executar.
- Nunca execute múltiplas operações destrutivas em sequência sem confirmação intermediária.

REGRA DE EXECUÇÃO PÓS-CONFIRMAÇÃO (crítica):
- Se você pediu confirmação ("Confirma?", "Posso prosseguir?") e o usuário respondeu
  afirmativamente ("sim", "pode", "confirmo", "vai", "ok", "pode confirmar"), você DEVE
  chamar a tool imediatamente na próxima resposta. NÃO repita os parâmetros. NÃO descreva
  de novo o que vai fazer. Apenas execute a tool.
- Se faltar algum parâmetro obrigatório, pergunte só o que falta — não reabra a discussão
  sobre o que já foi combinado.`;

export async function chatHandler(req: Request, res: Response) {
  const token = req.header("x-azion-token");

  if (!token) {
    res.status(401).json({ error: "X-Azion-Token ausente" });
    return;
  }
  if (!env.openrouterApiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY não configurado no servidor" });
    return;
  }

  // `useChat` from @tanstack/ai-react POSTs the conversation in AG-UI's
  // RunAgentInput shape, where messages are UIMessages with `parts` (text,
  // tool-call, tool-result, …) — NOT a plain `{role, content}` array.
  // `chatParamsFromRequestBody` validates the shape and normalizes the
  // messages so the assistant's tool_call / tool_result history round-trips
  // back to the LLM with the right tool_call_id linkage. Without this step,
  // multi-turn chats break with "Tool message must have either name or
  // tool_call_id" on the second user turn.
  let params;
  try {
    params = await chatParamsFromRequestBody(req.body);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  try {
    const mcpTools = await getTools();

    // Bridge each MCP tool into a TanStack AI server tool. Each call opens a
    // fresh MCP client+transport via `callToolOneShot` — see the comment on
    // that helper for why we don't reuse a single connection across the
    // agent loop. The user's token is captured in closure here, so the
    // chat-route header is the single source of truth for auth.
    const tools = mcpTools.map((t) =>
      toolDefinition({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as JSONSchema,
      }).server(async (args) => {
        const input = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
        const result = await callToolOneShot(token, t.name, input);
        return result.content ?? result;
      }),
    );

    // Model is configured via env; the openrouter adapter types it as a
    // literal union of known IDs, so we widen at the boundary.
    const adapter = createOpenRouterText(env.defaultModel as Parameters<typeof createOpenRouterText>[0], env.openrouterApiKey, {
      serverURL: env.openrouterBaseUrl,
      httpReferer: env.openrouterSiteUrl || undefined,
      appTitle: env.openrouterAppName || undefined,
    });

    const stream = chat({
      adapter,
      messages: params.messages,
      tools,
      systemPrompts: [SYSTEM_PROMPT],
      agentLoopStrategy: maxIterations(4),
    });

    const response = toServerSentEventsResponse(stream);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
        (res as Response & { flush?: () => void }).flush?.();
      }
    }
  } catch (err) {
    console.error("[chat] error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: (err as Error).message });
    }
  } finally {
    res.end();
  }
}
