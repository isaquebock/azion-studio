import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

export function registerMarketplaceTools(server: McpServer) {
  server.tool(
    "azion_list_integrations",
    "Lista integrações disponíveis no Marketplace.",
    {
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ page = 1, page_size = 10 }) =>
      runTool(() => azionFetch("/marketplace/integrations", { query: { page, page_size } })),
  );

  server.tool(
    "azion_get_integration",
    "Detalha uma integração do Marketplace.",
    { integration_id: z.union([z.number(), z.string()]) },
    async ({ integration_id }) =>
      runTool(() => azionFetch(`/marketplace/integrations/${integration_id}`)),
  );

  server.tool(
    "azion_install_integration",
    "Instala uma integração do Marketplace em uma edge application.",
    {
      integration_id: z.union([z.number(), z.string()]),
      application_id: z.union([z.number(), z.string()]),
    },
    async ({ integration_id, ...body }) =>
      runTool(() =>
        azionFetch(`/marketplace/integrations/${integration_id}/install`, {
          method: "POST",
          body,
        }),
      ),
  );
}
