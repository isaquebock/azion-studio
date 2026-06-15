import type { Request, Response } from "express";
import OpenAI from "openai";
import { env } from "../env.js";
import { callToolLogged, createMcpClient, getTools } from "../mcp-tools.js";

const SYSTEM_PROMPT = `Você é um assistente especializado na plataforma Azion Edge Computing.

Você tem acesso a tools para gerenciar todos os recursos da conta Azion do usuário:
edge applications, edge functions, domínios, rules engine, edge storage, WAF,
real-time logs e marketplace.

IMPORTANTE — nomes de tools:
- TODAS as tools começam com o prefixo "azion_". Exemplos: azion_list_applications,
  azion_get_application, azion_create_domain, azion_list_edge_functions.
- NUNCA invente nomes nem omita o prefixo. Use exatamente o nome que aparece no catálogo
  de tools fornecido — qualquer variação (sem "azion_", em camelCase, com pontos) falha.
- Se não tiver certeza do nome exato, escolha a tool mais próxima do catálogo em vez
  de adivinhar.

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

type ChatMessage = { role: "user" | "assistant"; content: string };

type SseEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; result: unknown; is_error?: boolean }
  | { type: "done" }
  | { type: "error"; message: string };

function send(res: Response, ev: SseEvent) {
  res.write(`data: ${JSON.stringify(ev)}\n\n`);
  // Force flush so events reach the browser as soon as they're produced,
  // even behind compression middleware or buffering proxies.
  (res as Response & { flush?: () => void }).flush?.();
}

type AccumulatedToolCall = { index: number; id: string; name: string; args: string };

export async function chatHandler(req: Request, res: Response) {
  const token = req.header("x-azion-token");
  const messages = (req.body?.messages ?? []) as ChatMessage[];

  if (!token) {
    res.status(401).json({ error: "X-Azion-Token ausente" });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages vazio" });
    return;
  }
  if (!env.openrouterApiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY não configurado no servidor" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const { mcp, transport } = createMcpClient(token);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try { await transport.close(); } catch { /* noop */ }
  };
  res.on("close", () => { void close(); });

  try {
    // Tools são cacheadas globalmente — só precisamos conectar este client para callTool.
    const [tools] = await Promise.all([getTools(), mcp.connect(transport)]);

    const defaultHeaders: Record<string, string> = {};
    if (env.openrouterSiteUrl) defaultHeaders["HTTP-Referer"] = env.openrouterSiteUrl;
    if (env.openrouterAppName) defaultHeaders["X-Title"] = env.openrouterAppName;

    const openai = new OpenAI({
      apiKey: env.openrouterApiKey,
      baseURL: env.openrouterBaseUrl,
      defaultHeaders,
    });

    const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content }) as
        OpenAI.Chat.Completions.ChatCompletionMessageParam),
    ];

    const MAX_STEPS = 4;
    let silentRetries = 0;
    for (let step = 0; step < MAX_STEPS; step++) {
      const stepStart = performance.now();
      let firstTokenAt: number | null = null;
      let tokenCount = 0;

      const stream = await openai.chat.completions.create({
        model: env.defaultModel,
        messages: convo,
        tools,
        tool_choice: "auto",
        stream: true,
      });

      let assistantContent = "";
      const toolAcc = new Map<number, AccumulatedToolCall>();
      let finishReason: string | null = null;
      let providerError: unknown = null;

      for await (const chunk of stream) {
        // OpenRouter / OpenAI-compat: erros vêm como campo `error` no chunk em vez de throw.
        const chunkErr = (chunk as { error?: unknown }).error;
        if (chunkErr) {
          providerError = chunkErr;
          finishReason = "error";
          console.error("[chat] provider error chunk:", JSON.stringify(chunkErr));
          send(res, {
            type: "error",
            message:
              (chunkErr as { message?: string })?.message ??
              JSON.stringify(chunkErr),
          });
          break;
        }
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;

        if (delta?.content) {
          if (firstTokenAt == null) firstTokenAt = performance.now();
          tokenCount++;
          assistantContent += delta.content;
          send(res, { type: "text", delta: delta.content });
        }

        if (delta?.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            const idx = tcDelta.index ?? 0;
            let acc = toolAcc.get(idx);
            if (!acc) {
              acc = { index: idx, id: "", name: "", args: "" };
              toolAcc.set(idx, acc);
            }
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function?.name) acc.name += tcDelta.function.name;
            if (tcDelta.function?.arguments) acc.args += tcDelta.function.arguments;
          }
        }

        if (choice.finish_reason) finishReason = choice.finish_reason;
      }

      const orderedCalls = [...toolAcc.values()].sort((a, b) => a.index - b.index);

      const stepEnd = performance.now();
      const ttft = firstTokenAt != null ? Math.round(firstTokenAt - stepStart) : null;
      const totalMs = Math.round(stepEnd - stepStart);
      const tps =
        firstTokenAt != null && tokenCount > 0
          ? Math.round((tokenCount / Math.max(1, stepEnd - firstTokenAt)) * 1000)
          : 0;
      const errSuffix = providerError
        ? ` error=${JSON.stringify(providerError).slice(0, 300)}`
        : "";
      console.log(
        `[chat] step=${step} ttft_ms=${ttft ?? "-"} total_ms=${totalMs} ` +
          `tokens=${tokenCount} tokens_per_s=${tps} tool_calls=${orderedCalls.length} ` +
          `finish=${finishReason ?? "-"}${errSuffix}`,
      );

      // Provider devolveu finish=error sem conteúdo nem chunk de erro: hiccup transitório.
      // Tenta o mesmo step uma vez antes de desistir.
      if (
        finishReason === "error" &&
        !providerError &&
        tokenCount === 0 &&
        orderedCalls.length === 0 &&
        silentRetries < 1
      ) {
        silentRetries++;
        console.warn(`[chat] step=${step} silent error, retrying once`);
        step--;
        continue;
      }

      if (finishReason === "error") {
        if (!providerError) {
          send(res, {
            type: "error",
            message: "O provedor LLM encerrou o stream com erro. Tente novamente.",
          });
        }
        break;
      }

      // Emite tool_call no SSE depois de juntar os fragmentos (já com args completos).
      for (const tc of orderedCalls) {
        let parsedArgs: unknown = {};
        try { parsedArgs = tc.args ? JSON.parse(tc.args) : {}; }
        catch { parsedArgs = { _raw: tc.args }; }
        send(res, { type: "tool_call", id: tc.id, name: tc.name, input: parsedArgs });
      }

      convo.push({
        role: "assistant",
        content: assistantContent || null,
        tool_calls: orderedCalls.length
          ? orderedCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.args || "{}" },
            }))
          : undefined,
      });

      if (!orderedCalls.length || finishReason !== "tool_calls") break;

      for (const tc of orderedCalls) {
        let args: Record<string, unknown> = {};
        try { args = tc.args ? JSON.parse(tc.args) : {}; }
        catch { /* keep empty */ }
        let resultText: string;
        let isErr = false;
        try {
          const result = await callToolLogged(mcp, tc.name, args);
          isErr = Boolean((result as { isError?: boolean }).isError);
          resultText = JSON.stringify(result.content ?? result);
          send(res, { type: "tool_result", id: tc.id, result: result.content ?? result, is_error: isErr });
        } catch (err) {
          isErr = true;
          resultText = (err as Error).message;
          send(res, { type: "tool_result", id: tc.id, result: resultText, is_error: true });
        }
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultText,
        });
      }
    }

    send(res, { type: "done" });
  } catch (err) {
    send(res, { type: "error", message: (err as Error).message });
  } finally {
    await close();
    res.end();
  }
}
