import { useMemo } from "react";
import type {
  Change,
  DomainData,
  EdgeAppData,
  EdgeFunctionData,
  ResourceKind,
  RuleData,
  Topology,
  WorkingNode,
} from "./types";

type AnyData = EdgeAppData | DomainData | EdgeFunctionData | RuleData;

/**
 * Pull a working-node's id as a number if it represents an existing remote
 * resource, otherwise null (still a local placeholder like "new-abc").
 */
function asRemoteId(id: string): number | null {
  if (id.startsWith("new-")) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare two resource payloads for diff purposes. JSON.stringify keeps it
 * cheap and order-insensitive enough for our shallow shapes.
 */
function isEqual(a: AnyData, b: AnyData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function lookupSnapshot(
  topology: Topology,
  kind: ResourceKind,
  id: number,
): AnyData | undefined {
  if (kind === "edge_app") return topology.apps.find((a) => a.id === id);
  if (kind === "domain") return topology.domains.find((d) => d.id === id);
  if (kind === "edge_function") return topology.functions.find((f) => f.id === id);
  if (kind === "rule") return topology.rules.find((r) => r.id === id);
  return undefined;
}

export function diffWorkingTree(
  snapshot: Topology,
  workingTree: WorkingNode[],
  deletedRemoteIds: Array<{ kind: ResourceKind; id: number; before: AnyData }>,
): Change[] {
  const changes: Change[] = [];

  for (const node of workingTree) {
    const remoteId = asRemoteId(node.id);
    if (remoteId == null) {
      changes.push({
        op: "create",
        kind: node.kind,
        localId: node.id,
        data: node.data,
      });
      continue;
    }
    const before = lookupSnapshot(snapshot, node.kind, remoteId);
    if (!before) {
      // Snapshot lost track of it (rare). Treat as create.
      changes.push({
        op: "create",
        kind: node.kind,
        localId: node.id,
        data: node.data,
      });
      continue;
    }
    if (!isEqual(before, node.data)) {
      changes.push({
        op: "update",
        kind: node.kind,
        id: remoteId,
        before,
        after: node.data,
      });
    }
  }

  for (const d of deletedRemoteIds) {
    changes.push({ op: "delete", kind: d.kind, id: d.id, before: d.before });
  }

  return changes;
}

export function useChangeSet(
  snapshot: Topology | null,
  workingTree: WorkingNode[],
  deletedRemoteIds: Array<{ kind: ResourceKind; id: number; before: AnyData }>,
): Change[] {
  return useMemo(() => {
    if (!snapshot) return [];
    return diffWorkingTree(snapshot, workingTree, deletedRemoteIds);
  }, [snapshot, workingTree, deletedRemoteIds]);
}
