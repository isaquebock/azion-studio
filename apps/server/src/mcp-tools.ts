import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { env } from "./env.js";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

let cached: Promise<McpTool[]> | null = null;

async function fetchTools(): Promise<McpTool[]> {
  const mcp = new McpClient({ name: "azion-studio-host-bootstrap", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(env.mcpServerUrl), {
    // O MCP server exige Authorization, mas tools/list não usa o token (apenas tools/call usa).
    // Qualquer string serve apenas para passar o middleware.
    requestInit: { headers: { Authorization: "Token bootstrap" } },
  });
  const start = performance.now();
  try {
    await mcp.connect(transport);
    const list = await mcp.listTools();
    console.log(
      `[mcp] listTools count=${list.tools.length} ${(performance.now() - start).toFixed(1)}ms`,
    );
    return list.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
    }));
  } finally {
    await transport.close().catch(() => undefined);
  }
}

export function getTools(): Promise<McpTool[]> {
  if (!cached) {
    cached = fetchTools().catch((err) => {
      cached = null; // tenta de novo no próximo request
      throw err;
    });
  }
  return cached;
}

export function preloadTools(): void {
  void getTools().catch((err) => {
    console.warn("[server] preload de tools MCP falhou:", (err as Error).message);
  });
}

export function createMcpClient(azionToken: string) {
  const mcp = new McpClient({ name: "azion-studio-host", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(env.mcpServerUrl), {
    requestInit: { headers: { Authorization: `Token ${azionToken}` } },
  });
  return { mcp, transport };
}

export async function resolveToolName(requested: string): Promise<string | null> {
  const tools = await getTools();
  const names = tools.map((t) => t.name);
  if (names.includes(requested)) return requested;

  // Modelos às vezes esquecem o prefixo (`list_applications` em vez de `azion_list_applications`).
  const withPrefix = `azion_${requested}`;
  if (names.includes(withPrefix)) return withPrefix;

  // Match por sufixo (último recurso): `applications.list` → `azion_list_applications`.
  const normalized = requested.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const candidate = names.find(
    (n) => n.toLowerCase().endsWith(normalized) || n.toLowerCase() === normalized,
  );
  return candidate ?? null;
}

/**
 * One-shot tool invocation: opens a fresh MCP client+transport for THIS call
 * only, runs `tools/call`, and tears the transport down in `finally`.
 *
 * Used by the chat route, where the LLM may emit multiple tool_calls in a
 * single agent loop. Reusing a single transport for N calls against the
 * stateless MCP server (`sessionIdGenerator: undefined`) leaves the second
 * `callTool` racing a half-closed SSE stream — splitting per-call removes
 * the shared-state failure mode entirely. Cost: +1 init handshake per call,
 * negligible against the LLM round-trip.
 *
 * For batched workflows like Interactive Mode's loadTopology / applyChangeset
 * (one handler, many sequential calls), keep using `callToolLogged` with a
 * shared client — those run serially under one user action.
 */
export async function callToolOneShot(
  azionToken: string,
  name: string,
  args: Record<string, unknown>,
) {
  const { mcp, transport } = createMcpClient(azionToken);
  try {
    await mcp.connect(transport);
    return await callToolLogged(mcp, name, args);
  } finally {
    await transport.close().catch(() => undefined);
  }
}

export async function callToolLogged(
  mcp: McpClient,
  name: string,
  args: Record<string, unknown>,
) {
  const resolved = await resolveToolName(name);
  if (!resolved) {
    console.log(`[mcp] callTool name=${name} unresolved`);
    throw new Error(`Tool not found: ${name}`);
  }
  if (resolved !== name) {
    console.log(`[mcp] resolved ${name} -> ${resolved}`);
  }
  const start = performance.now();
  try {
    const result = await mcp.callTool({ name: resolved, arguments: args });
    const ms = (performance.now() - start).toFixed(1);
    const isErr = Boolean((result as { isError?: boolean }).isError);
    console.log(`[mcp] callTool name=${resolved} ${ms}ms ${isErr ? "error" : "ok"}`);
    return result;
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    console.log(
      `[mcp] callTool name=${resolved} ${ms}ms throw="${(err as Error).message}"`,
    );
    throw err;
  }
}
