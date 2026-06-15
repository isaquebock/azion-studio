import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

export function registerDomainsDnsTools(server: McpServer) {
  server.tool(
    "azion_list_domains",
    "Lista todos os domínios da conta.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/domains", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_domain",
    "Detalha um domínio por ID.",
    { domain_id: z.union([z.number(), z.string()]) },
    async ({ domain_id }) => runTool(() => azionFetch(`/domains/${domain_id}`)),
  );

  server.tool(
    "azion_create_domain",
    "Cria um novo domínio associado a uma edge application.",
    {
      name: z.string(),
      edge_application_id: z.union([z.number(), z.string()]),
      cnames: z.array(z.string()).optional(),
      cname_access_only: z.boolean().optional(),
      is_active: z.boolean().optional(),
    },
    async (body) => runTool(() => azionFetch("/domains", { method: "POST", body })),
  );

  server.tool(
    "azion_update_domain",
    "Atualiza um domínio existente.",
    {
      domain_id: z.union([z.number(), z.string()]),
      name: z.string().optional(),
      cnames: z.array(z.string()).optional(),
      is_active: z.boolean().optional(),
    },
    async ({ domain_id, ...patch }) =>
      runTool(() => azionFetch(`/domains/${domain_id}`, { method: "PATCH", body: patch })),
  );

  server.tool(
    "azion_delete_domain",
    "Remove um domínio. Operação destrutiva.",
    { domain_id: z.union([z.number(), z.string()]) },
    async ({ domain_id }) =>
      runTool(() => azionFetch(`/domains/${domain_id}`, { method: "DELETE" })),
  );

  server.tool(
    "azion_list_zones",
    "Lista as zonas DNS (Intelligent DNS) da conta.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/intelligent_dns", { query: { page, page_size } })),
  );
}
