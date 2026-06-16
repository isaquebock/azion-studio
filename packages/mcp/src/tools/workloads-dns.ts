import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

/**
 * Workloads são a evolução v4 do conceito de "domain". O recurso ainda
 * carrega CNAMEs e a associação com uma edge application, mas vive em
 * `/v4/workspace/workloads` e o shape de body pode divergir do antigo
 * `/domains`. Os campos abaixo refletem o que o produto suporta hoje;
 * ajustar conforme o servidor retornar 422 no smoke test.
 */
export function registerWorkloadsDnsTools(server: McpServer) {
  server.tool(
    "azion_list_workloads",
    "Lista os workloads (antigo 'domains') da conta.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/v4/workspace/workloads", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_workload",
    "Detalha um workload por ID.",
    { workload_id: z.union([z.number(), z.string()]) },
    async ({ workload_id }) =>
      runTool(() => azionFetch(`/v4/workspace/workloads/${workload_id}`)),
  );

  server.tool(
    "azion_create_workload",
    "Cria um novo workload associado a uma edge application.",
    {
      name: z.string(),
      edge_application_id: z.union([z.number(), z.string()]),
      cnames: z.array(z.string()).optional(),
      cname_access_only: z.boolean().optional(),
      is_active: z.boolean().optional(),
    },
    async (body) =>
      runTool(() => azionFetch("/v4/workspace/workloads", { method: "POST", body })),
  );

  server.tool(
    "azion_update_workload",
    "Atualiza um workload existente.",
    {
      workload_id: z.union([z.number(), z.string()]),
      name: z.string().optional(),
      cnames: z.array(z.string()).optional(),
      is_active: z.boolean().optional(),
    },
    async ({ workload_id, ...patch }) =>
      runTool(() =>
        azionFetch(`/v4/workspace/workloads/${workload_id}`, { method: "PATCH", body: patch }),
      ),
  );

  server.tool(
    "azion_delete_workload",
    "Remove um workload. Operação destrutiva.",
    { workload_id: z.union([z.number(), z.string()]) },
    async ({ workload_id }) =>
      runTool(() => azionFetch(`/v4/workspace/workloads/${workload_id}`, { method: "DELETE" })),
  );

  server.tool(
    "azion_list_dns_zones",
    "Lista as zonas DNS (Edge DNS) da conta.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/v4/edge_dns/zones", { query: { page, page_size } })),
  );
}
