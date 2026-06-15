import type { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolLogged } from "../mcp-tools.js";
import type {
  DomainData,
  EdgeAppData,
  EdgeFunctionData,
  RuleData,
  Topology,
} from "./types.js";

type AzionListResponse =
  | { results: unknown[] }
  | { data: unknown[] }
  | unknown[];

/**
 * MCP tools wrap results as `{ content: [{ type: "text", text: "<json>" }] }`.
 * Unwrap to the parsed Azion payload.
 */
function extractMcpJson(result: unknown): unknown {
  const r = result as { content?: Array<{ type: string; text?: string }> };
  const text = r.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function listFrom(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const p = payload as AzionListResponse;
  if (p && typeof p === "object" && "results" in p && Array.isArray(p.results)) return p.results;
  if (p && typeof p === "object" && "data" in p && Array.isArray(p.data)) return p.data;
  return [];
}

const PAGE_SIZE = 100;
const MAX_PAGES = 20; // safety cap — 2000 items/resource is more than enough for v1

/**
 * Walk pagination until the API returns a partial page (or empty). Stops
 * early if MAX_PAGES is hit — that's a signal we should switch to cursor-based
 * pagination later, not a silent truncation.
 */
async function listAll(
  toolName: string,
  baseArgs: Record<string, unknown>,
  call: (args: Record<string, unknown>) => Promise<unknown>,
): Promise<unknown[]> {
  const collected: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const raw = await call({ ...baseArgs, page, page_size: PAGE_SIZE });
    const batch = listFrom(extractMcpJson(raw));
    collected.push(...batch);
    if (batch.length < PAGE_SIZE) return collected;
  }
  console.warn(`[ops] ${toolName} hit MAX_PAGES (${MAX_PAGES}) — results may be truncated`);
  return collected;
}

function toEdgeApp(raw: unknown): EdgeAppData {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    delivery_protocol: r.delivery_protocol as EdgeAppData["delivery_protocol"],
    raw,
  };
}

function toDomain(raw: unknown): DomainData {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    cname_access_only: Boolean(r.cname_access_only),
    cnames: Array.isArray(r.cnames) ? (r.cnames as string[]) : [],
    edge_application_id: Number(r.edge_application_id ?? r.application_id ?? 0),
    digital_certificate_id:
      r.digital_certificate_id != null ? Number(r.digital_certificate_id) : null,
    raw,
  };
}

function toFunction(raw: unknown): EdgeFunctionData {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    code: String(r.code ?? ""),
    language: (r.language as EdgeFunctionData["language"]) ?? "javascript",
    initiator_type: r.initiator_type as EdgeFunctionData["initiator_type"],
    raw,
  };
}

function toRule(raw: unknown, application_id: number, phase: "request" | "response"): RuleData {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    application_id,
    phase,
    description: r.description ? String(r.description) : undefined,
    criteria: r.criteria,
    behaviors: r.behaviors,
    raw,
  };
}

export async function loadTopology(mcp: McpClient): Promise<Topology> {
  // Apps, domains and functions are independent — fetch in parallel,
  // each one walking pagination internally.
  const [appsRaw, domainsRaw, functionsRaw] = await Promise.all([
    listAll("azion_list_applications", {}, (args) =>
      callToolLogged(mcp, "azion_list_applications", args),
    ),
    listAll("azion_list_domains", {}, (args) =>
      callToolLogged(mcp, "azion_list_domains", args),
    ),
    listAll("azion_list_functions", {}, (args) =>
      callToolLogged(mcp, "azion_list_functions", args),
    ),
  ]);

  const apps = appsRaw.map(toEdgeApp);
  const domains = domainsRaw.map(toDomain);
  const functions = functionsRaw.map(toFunction);

  // Rules require an application_id + phase. v1 fetches the request phase for
  // every app in parallel; response phase deferred until v2 to halve API hits.
  const ruleResults = await Promise.all(
    apps
      .filter((a): a is EdgeAppData & { id: number } => typeof a.id === "number" && !Number.isNaN(a.id))
      .map(async (app) => {
        try {
          const raw = await listAll("azion_list_rules", { application_id: app.id, phase: "request" }, (args) =>
            callToolLogged(mcp, "azion_list_rules", args),
          );
          return raw.map((r) => toRule(r, app.id!, "request"));
        } catch {
          return [] as RuleData[];
        }
      }),
  );
  const rules = ruleResults.flat();

  return { apps, domains, functions, rules };
}
