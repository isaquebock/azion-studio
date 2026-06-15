import type { Request, Response } from "express";
import { createMcpClient } from "../mcp-tools.js";
import { applyChangeset } from "../ops/apply-changeset.js";
import { loadTopology } from "../ops/load-topology.js";
import type { ApplyEvent, Change } from "../ops/types.js";

function requireToken(req: Request, res: Response): string | null {
  const token = req.header("x-azion-token");
  if (!token) {
    res.status(401).json({ error: "X-Azion-Token ausente" });
    return null;
  }
  return token;
}

export async function topologyHandler(req: Request, res: Response): Promise<void> {
  const token = requireToken(req, res);
  if (!token) return;

  const { mcp, transport } = createMcpClient(token);
  try {
    await mcp.connect(transport);
    const topology = await loadTopology(mcp);
    res.json(topology);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  } finally {
    void transport.close().catch(() => undefined);
  }
}

export async function applyHandler(req: Request, res: Response): Promise<void> {
  const token = requireToken(req, res);
  if (!token) return;

  const changes = (req.body?.changes ?? []) as Change[];
  if (!Array.isArray(changes)) {
    res.status(400).json({ error: "changes deve ser um array" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (ev: ApplyEvent) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
    (res as Response & { flush?: () => void }).flush?.();
  };

  const { mcp, transport } = createMcpClient(token);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      await transport.close();
    } catch {
      /* noop */
    }
  };
  res.on("close", () => void close());

  try {
    await mcp.connect(transport);
    await applyChangeset(mcp, changes, send);
  } catch (err) {
    send({ type: "error", message: (err as Error).message });
  } finally {
    await close();
    res.end();
  }
}
