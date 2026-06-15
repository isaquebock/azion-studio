import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

export function registerEdgeStorageTools(server: McpServer) {
  server.tool(
    "azion_list_buckets",
    "Lista os buckets de Edge Storage.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/v4/storage/buckets", { query: { page, page_size } })),
  );

  server.tool(
    "azion_create_bucket",
    "Cria um novo bucket de Edge Storage.",
    {
      name: z.string(),
      edge_access: z.enum(["read_only", "read_write", "restricted"]).optional(),
    },
    async (body) =>
      runTool(() => azionFetch("/v4/storage/buckets", { method: "POST", body })),
  );

  server.tool(
    "azion_list_objects",
    "Lista objetos dentro de um bucket.",
    {
      bucket_name: z.string(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ bucket_name, page_size = 10 }) =>
      runTool(() => azionFetch(`/v4/storage/buckets/${bucket_name}/objects`, { query: { page_size } })),
  );

  server.tool(
    "azion_delete_object",
    "Remove um objeto de um bucket. Operação destrutiva.",
    { bucket_name: z.string(), object_key: z.string() },
    async ({ bucket_name, object_key }) =>
      runTool(() =>
        azionFetch(`/v4/storage/buckets/${bucket_name}/objects/${encodeURIComponent(object_key)}`, {
          method: "DELETE",
        }),
      ),
  );
}
