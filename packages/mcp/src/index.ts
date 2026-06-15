import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createApp } from "./server.js";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

const port = Number(process.env.MCP_PORT ?? 3002);
const app = createApp();

app.listen(port, () => {
  console.log(`[azion-mcp] listening on http://localhost:${port}/mcp`);
});
