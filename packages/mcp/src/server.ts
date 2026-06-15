import express, { type Request, type Response } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "./tools/index.js";
import { tokenStore } from "./token-context.js";

export function createApp() {
  const app = express();
  app.use(cors({ exposedHeaders: ["mcp-session-id"] }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, name: "azion-mcp" });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Personal Token Azion ausente (header Authorization)" },
        id: null,
      });
      return;
    }

    await tokenStore.run(token, async () => {
      const server = new McpServer(
        { name: "azion-mcp", version: "0.1.0" },
        { capabilities: { tools: {} } },
      );
      registerAllTools(server);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      res.on("close", () => {
        transport.close().catch(() => undefined);
        server.close().catch(() => undefined);
      });

      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: (err as Error).message },
            id: null,
          });
        }
      }
    });
  });

  return app;
}

function extractToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (trimmed.toLowerCase().startsWith("token ")) return trimmed.slice(6).trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) return trimmed.slice(7).trim();
  return trimmed || undefined;
}

void randomUUID; // reserved for future stateful mode
