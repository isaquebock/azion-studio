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
      runTool(() => azionFetch("/waf/rulesets", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_waf_rule",
    "Detalha um rule set WAF.",
    { waf_id: z.union([z.number(), z.string()]) },
    async ({ waf_id }) => runTool(() => azionFetch(`/waf/rulesets/${waf_id}`)),
  );

  server.tool(
    "azion_create_waf_allowlist",
    "Cria uma entrada no allowlist de um rule set WAF.",
    {
      waf_id: z.union([z.number(), z.string()]),
      value: z.string(),
      match_criteria: z.string().describe("Critério de match, ex.: 'request_header_name'"),
    },
    async ({ waf_id, ...body }) =>
      runTool(() => azionFetch(`/waf/rulesets/${waf_id}/allowlist`, { method: "POST", body })),
  );

  server.tool(
    "azion_list_waf_events",
    "Lista eventos do WAF para um rule set em uma janela de tempo.",
    {
      waf_id: z.union([z.number(), z.string()]),
      hour_range: z.number().int().min(1).max(72).optional().describe("Janela em horas (default: 1)"),
      domains_ids: z.string().optional().describe("CSV de IDs de domínios"),
    },
    async ({ waf_id, hour_range = 1, domains_ids }) =>
      runTool(() =>
        azionFetch(`/waf/${waf_id}/waf_events`, {
          query: { hour_range, domains_ids },
        }),
      ),
  );
}
