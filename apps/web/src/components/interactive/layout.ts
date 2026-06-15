import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const H_STRIDE = 280; // x distance between disconnected nodes in the grid
const V_STRIDE = 120; // y distance between rows
const COLUMNS = 3; // grid width for disconnected nodes

/**
 * Lays out a graph in two passes:
 *  1. Dagre (left → right) for nodes that participate in at least one edge.
 *  2. A simple grid for fully-disconnected nodes, placed below the dagre
 *     cluster so they don't overlap with it.
 *
 * Dagre alone would stack disconnected nodes in a single column (all at
 * rank 0), making the canvas look like one tall stack on first load — the
 * grid pass is what spreads them across the viewport.
 */
export function layoutGraph(nodes: Node[], edges: Edge[]): Node[] {
  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }

  const connected = nodes.filter((n) => connectedIds.has(n.id));
  const disconnected = nodes.filter((n) => !connectedIds.has(n.id));

  let connectedPositions = new Map<string, { x: number; y: number }>();
  let connectedMaxY = 0;

  if (connected.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 96 });
    for (const n of connected) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    for (const e of edges) g.setEdge(e.source, e.target);
    dagre.layout(g);
    for (const n of connected) {
      const pos = g.node(n.id);
      if (!pos) continue;
      const xy = {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      };
      connectedPositions.set(n.id, xy);
      if (xy.y + NODE_HEIGHT > connectedMaxY) connectedMaxY = xy.y + NODE_HEIGHT;
    }
  }

  // Disconnected nodes go below the dagre cluster, in a fixed-width grid.
  const gridOriginY = connectedMaxY === 0 ? 0 : connectedMaxY + V_STRIDE;
  const disconnectedPositions = new Map<string, { x: number; y: number }>();
  disconnected.forEach((n, i) => {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    disconnectedPositions.set(n.id, {
      x: col * H_STRIDE,
      y: gridOriginY + row * V_STRIDE,
    });
  });

  return nodes.map((n) => {
    const pos =
      connectedPositions.get(n.id) ?? disconnectedPositions.get(n.id) ?? n.position;
    return { ...n, position: pos };
  });
}
