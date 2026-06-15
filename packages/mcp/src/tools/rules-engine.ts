import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azionFetch, runTool } from "../azion-client.js";

const phaseSchema = z.enum(["request", "response"]).describe("Fase da regra");

export function registerRulesEngineTools(server: McpServer) {
  server.tool(
    "azion_list_rules",
    "Lista regras do Rules Engine de uma edge application em uma fase específica.",
    {
      application_id: z.union([z.number(), z.string()]),
      phase: phaseSchema,
      page: z.number().int().positive().optional(),
      page_size: z.number().int().positive().max(100).optional(),
    },
    async ({ application_id, phase, page = 1, page_size = 10 }) =>
      runTool(() =>
        azionFetch(`/edge_applications/${application_id}/rules_engine/${phase}/rules`, {
          query: { page, page_size },
        }),
      ),
  );

  server.tool(
    "azion_get_rule",
    "Detalha uma regra do Rules Engine.",
    {
      application_id: z.union([z.number(), z.string()]),
      phase: phaseSchema,
      rule_id: z.union([z.number(), z.string()]),
    },
    async ({ application_id, phase, rule_id }) =>
      runTool(() =>
        azionFetch(`/edge_applications/${application_id}/rules_engine/${phase}/rules/${rule_id}`),
      ),
  );

  server.tool(
    "azion_create_rule",
    "Cria uma nova regra no Rules Engine.",
    {
      application_id: z.union([z.number(), z.string()]),
      phase: phaseSchema,
      name: z.string(),
      criteria: z.array(z.array(z.record(z.unknown()))).describe("Matriz de critérios"),
      behaviors: z.array(z.record(z.unknown())),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
    },
    async ({ application_id, phase, ...body }) =>
      runTool(() =>
        azionFetch(`/edge_applications/${application_id}/rules_engine/${phase}/rules`, {
          method: "POST",
          body,
        }),
      ),
  );

  server.tool(
    "azion_update_rule",
    "Atualiza uma regra do Rules Engine.",
    {
      application_id: z.union([z.number(), z.string()]),
      phase: phaseSchema,
      rule_id: z.union([z.number(), z.string()]),
      name: z.string().optional(),
      criteria: z.array(z.array(z.record(z.unknown()))).optional(),
      behaviors: z.array(z.record(z.unknown())).optional(),
      is_active: z.boolean().optional(),
    },
    async ({ application_id, phase, rule_id, ...patch }) =>
      runTool(() =>
        azionFetch(`/edge_applications/${application_id}/rules_engine/${phase}/rules/${rule_id}`, {
          method: "PATCH",
          body: patch,
        }),
      ),
  );

  server.tool(
    "azion_delete_rule",
    "Remove uma regra do Rules Engine. Operação destrutiva.",
    {
      application_id: z.union([z.number(), z.string()]),
      phase: phaseSchema,
      rule_id: z.union([z.number(), z.string()]),
    },
    async ({ application_id, phase, rule_id }) =>
      runTool(() =>
        azionFetch(`/edge_applications/${application_id}/rules_engine/${phase}/rules/${rule_id}`, {
          method: "DELETE",
        }),
      ),
  );
}
