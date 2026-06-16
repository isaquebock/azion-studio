import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

export function registerRealtimeLogsTools(server: McpServer) {
  server.tool(
    "azion_list_data_streams",
    "Lista data streams de logs em tempo real.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/v4/data_stream/streams", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_data_stream",
    "Detalha um data stream por ID.",
    { stream_id: z.union([z.number(), z.string()]) },
    async ({ stream_id }) => runTool(() => azionFetch(`/v4/data_stream/streams/${stream_id}`)),
  );

  server.tool(
    "azion_create_data_stream",
    "Cria um novo data stream de logs.",
    {
      name: z.string(),
      template_id: z.union([z.number(), z.string()]),
      data_source: z.string().optional().default("http"),
      domain_ids: z.array(z.union([z.number(), z.string()])).optional(),
      endpoint: z.record(z.unknown()).describe("Config do endpoint (URL, headers, etc.)"),
      active: z.boolean().optional(),
    },
    async (body) =>
      runTool(() => azionFetch("/v4/data_stream/streams", { method: "POST", body })),
  );
}
