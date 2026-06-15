import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

export const env = {
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  openrouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "",
  openrouterAppName: process.env.OPENROUTER_APP_NAME ?? "Azion Chat",
  defaultModel: process.env.DEFAULT_MODEL ?? "google/gemini-2.5-flash-lite",
  mcpServerUrl: process.env.MCP_SERVER_URL ?? "http://localhost:3002/mcp",
  port: Number(process.env.SERVER_PORT ?? 3001),
};

if (!env.openrouterApiKey) {
  console.warn("[server] OPENROUTER_API_KEY ausente — /api/chat vai falhar");
}
