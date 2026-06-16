import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

export function registerEdgeFunctionTools(server: McpServer) {
  server.tool(
    "azion_list_functions",
    "Lista todas as functions da conta.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/v4/workspace/functions", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_function",
    "Detalha uma edge function por ID.",
    { function_id: z.union([z.number(), z.string()]) },
    async ({ function_id }) => runTool(() => azionFetch(`/v4/workspace/functions/${function_id}`)),
  );

  server.tool(
    "azion_create_function",
    "Cria uma nova edge function.",
    {
      name: z.string(),
      code: z.string().describe("Código JS/TS da function"),
      language: z.string().optional().default("javascript"),
      initiator_type: z.string().optional(),
      json_args: z.record(z.unknown()).optional(),
    },
    async (body) => runTool(() => azionFetch("/v4/workspace/functions", { method: "POST", body })),
  );

  server.tool(
    "azion_update_function",
    "Atualiza código ou configuração de uma edge function.",
    {
      function_id: z.union([z.number(), z.string()]),
      name: z.string().optional(),
      code: z.string().optional(),
      json_args: z.record(z.unknown()).optional(),
      active: z.boolean().optional(),
    },
    async ({ function_id, ...patch }) =>
      runTool(() => azionFetch(`/v4/workspace/functions/${function_id}`, { method: "PATCH", body: patch })),
  );

  server.tool(
    "azion_delete_function",
    "Remove uma edge function. Operação destrutiva.",
    { function_id: z.union([z.number(), z.string()]) },
    async ({ function_id }) =>
      runTool(() => azionFetch(`/v4/workspace/functions/${function_id}`, { method: "DELETE" })),
  );
}
