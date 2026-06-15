import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

export function registerEdgeAppTools(server: McpServer) {
  server.tool(
    "azion_list_applications",
    "Lista todas as edge applications da conta Azion do usuário.",
    {
      page: z.number().int().positive().optional().describe("Página (default: 1)"),
      page_size: z.number().int().positive().max(100).optional().describe("Itens por página (default: 10)"),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/v4/workspace/applications", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_application",
    "Detalha uma edge application por ID.",
    { application_id: z.union([z.number(), z.string()]).describe("ID da edge application") },
    async ({ application_id }) =>
      runTool(() => azionFetch(`/v4/workspace/applications/${application_id}`)),
  );

  server.tool(
    "azion_create_application",
    "Cria uma nova edge application.",
    {
      name: z.string(),
      delivery_protocol: z.enum(["http", "http,https"]).optional(),
      http_port: z.array(z.number()).optional(),
      https_port: z.array(z.number()).optional(),
      minimum_tls_version: z.string().optional(),
    },
    async (body) =>
      runTool(() => azionFetch("/v4/workspace/applications", { method: "POST", body })),
  );

  server.tool(
    "azion_update_application",
    "Atualiza configurações de uma edge application existente.",
    {
      application_id: z.union([z.number(), z.string()]),
      name: z.string().optional(),
      delivery_protocol: z.string().optional(),
      http_port: z.array(z.number()).optional(),
      https_port: z.array(z.number()).optional(),
      active: z.boolean().optional(),
    },
    async ({ application_id, ...patch }) =>
      runTool(() =>
        azionFetch(`/v4/workspace/applications/${application_id}`, { method: "PATCH", body: patch }),
      ),
  );
}
