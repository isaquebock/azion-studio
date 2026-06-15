import "./env.js";
import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { chatHandler } from "./routes/chat.js";
import { preloadTools } from "./mcp-tools.js";

const app = express();

app.use(cors({ origin: true, exposedHeaders: ["x-mcp-error"] }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const { method, originalUrl } = req;
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      `[req] ${method} ${originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "azion-chat-server" });
});

app.post("/api/chat", chatHandler);

app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log(`[server] MCP at ${env.mcpServerUrl}`);
  preloadTools();
});
