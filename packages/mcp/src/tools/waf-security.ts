import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

export function registerWafSecurityTools(server: McpServer) {
  server.tool(
    "azion_list_waf_rules",
    "Lista rule sets do WAF.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/v4/workspace/waf_rulesets", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_waf_rule",
    "Detalha um rule set WAF.",
    { waf_id: z.union([z.number(), z.string()]) },
    async ({ waf_id }) => runTool(() => azionFetch(`/v4/workspace/waf_rulesets/${waf_id}`)),
  );

  server.tool(
    "azion_create_waf_allowlist",
    "Cria uma exceção (allowlist) em um rule set WAF.",
    {
      waf_id: z.union([z.number(), z.string()]),
      value: z.string(),
      match_criteria: z.string().describe("Critério de match, ex.: 'request_header_name'"),
    },
    async ({ waf_id, ...body }) =>
      runTool(() =>
        azionFetch(`/v4/workspace/waf_rulesets/${waf_id}/exceptions`, { method: "POST", body }),
      ),
  );

  // `azion_list_waf_events` foi removida na migração v4 — a URL v3
  // (`/waf/{id}/waf_events`) não tem equivalente confirmado em v4. Quando o
  // path correto for descoberto (passo 7 do plano), re-registrar aqui.
}
