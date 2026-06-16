import {
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "./canvas";
import { ApplyModal } from "./apply-modal";
import { InspectorDrawer } from "./inspector-drawer";
import { ResourcePalette } from "./resource-palette";
import { layoutGraph } from "./layout";
import { useTopology } from "./use-topology";
import { useChangeSet } from "./use-change-set";
import type {
  WorkloadData,
  EdgeAppData,
  EdgeFunctionData,
  ResourceKind,
  RuleData,
  Topology,
  WorkingNode,
} from "./types";

type AnyData = EdgeAppData | WorkloadData | EdgeFunctionData | RuleData;

let placeholderCounter = 0;
function newLocalId(): string {
  placeholderCounter++;
  return `new-${Date.now().toString(36)}-${placeholderCounter}`;
}

/**
 * Converts a Topology snapshot into the working-tree shape. Positions are
 * filled in by dagre downstream; we just seed (0,0).
 */
function topologyToWorkingTree(t: Topology): WorkingNode[] {
  const apps: WorkingNode[] = t.apps.map((a) => ({
    id: String(a.id ?? newLocalId()),
    kind: "edge_app",
    data: a,
    position: { x: 0, y: 0 },
  }));
  const functions: WorkingNode[] = t.functions.map((f) => ({
    id: String(f.id ?? newLocalId()),
    kind: "edge_function",
    data: f,
    position: { x: 0, y: 0 },
  }));
  const workloads: WorkingNode[] = t.workloads.map((d) => ({
    id: String(d.id ?? newLocalId()),
    kind: "workload",
    data: d,
    position: { x: 0, y: 0 },
  }));
  const rules: WorkingNode[] = t.rules.map((r) => ({
    id: String(r.id ?? newLocalId()),
    kind: "rule",
    data: r,
    position: { x: 0, y: 0 },
  }));
  return [...apps, ...functions, ...workloads, ...rules];
}

/**
 * Looks up the snapshot equivalent of a working node to detect dirty state.
 */
function isModified(node: WorkingNode, snapshot: Topology | null): boolean {
  if (!snapshot) return false;
  if (node.id.startsWith("new-")) return false;
  const id = Number(node.id);
  const remote =
    node.kind === "edge_app"
      ? snapshot.apps.find((x) => x.id === id)
      : node.kind === "workload"
        ? snapshot.workloads.find((x) => x.id === id)
        : node.kind === "edge_function"
          ? snapshot.functions.find((x) => x.id === id)
          : snapshot.rules.find((x) => x.id === id);
  if (!remote) return false;
  return JSON.stringify(remote) !== JSON.stringify(node.data);
}

function nodeTitle(n: WorkingNode): string {
  return (n.data as { name?: string }).name ?? "—";
}

function nodeSubtitle(n: WorkingNode, snapshot: Topology | null): string | undefined {
  if (n.kind === "workload") {
    const d = n.data as WorkloadData;
    const appName = appNameById(d.edge_application_id, snapshot);
    return appName ? `→ ${appName}` : undefined;
  }
  if (n.kind === "rule") {
    const r = n.data as RuleData;
    const appName = appNameById(r.application_id, snapshot);
    return appName ? `${r.phase} · ${appName}` : r.phase;
  }
  if (n.kind === "edge_app") {
    return (n.data as EdgeAppData).delivery_protocol ?? "http,https";
  }
  return undefined;
}

function appNameById(
  id: number | string | undefined,
  snapshot: Topology | null,
): string | undefined {
  if (id == null || id === "") return undefined;
  if (typeof id === "string" && id.startsWith("new-")) return "novo app";
  const numeric = Number(id);
  const found = snapshot?.apps.find((a) => a.id === numeric);
  return found?.name;
}

function defaultDataFor(kind: ResourceKind, apps: WorkingNode[]): AnyData {
  const firstAppId = apps[0]?.id ?? "";
  switch (kind) {
    case "edge_app":
      return { name: "Nova application", delivery_protocol: "http,https" };
    case "workload":
      return {
        name: "novo-workload",
        edge_application_id: firstAppId.startsWith("new-") ? firstAppId : Number(firstAppId) || "",
        cnames: [],
        cname_access_only: false,
      };
    case "edge_function":
      return {
        name: "nova-function",
        code: "// export default async function handler(request) {\n//   return new Response('hello edge');\n// }\n",
        language: "javascript",
      };
    case "rule":
      return {
        name: "Nova rule",
        application_id: firstAppId.startsWith("new-") ? firstAppId : Number(firstAppId) || "",
        phase: "request",
      };
  }
}

export function InteractiveMode() {
  const { topology, status, error, reload } = useTopology();

  const [workingTree, setWorkingTree] = useState<WorkingNode[]>([]);
  const [deletedRemote, setDeletedRemote] = useState<
    Array<{ kind: ResourceKind; id: number; before: AnyData }>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  // Seed working tree from snapshot on (re)load. Layout happens here so the
  // first render already has dagre-assigned positions — never (0,0). This
  // also avoids a race where a second effect would overwrite mid-stream.
  useEffect(() => {
    if (!topology) return;
    const raw = topologyToWorkingTree(topology);
    // Build the same node/edge shape the canvas will consume; dagre only
    // needs id + connectivity, so any consistent ids work.
    const tmpNodes: Node[] = raw.map((n) => ({
      id: n.id,
      type: n.kind,
      position: { x: 0, y: 0 },
      data: {},
    }));
    const tmpEdges: Edge[] = [];
    for (const n of raw) {
      if (n.kind === "workload") {
        const t = String((n.data as WorkloadData).edge_application_id ?? "");
        if (t) tmpEdges.push({ id: `e-${n.id}-${t}`, source: t, target: n.id });
      }
      if (n.kind === "rule") {
        const t = String((n.data as RuleData).application_id ?? "");
        if (t) tmpEdges.push({ id: `e-${n.id}-${t}`, source: t, target: n.id });
      }
    }
    const laid = layoutGraph(tmpNodes, tmpEdges);
    const positioned = raw.map((n) => {
      const m = laid.find((l) => l.id === n.id);
      return m ? { ...n, position: m.position } : n;
    });
    setWorkingTree(positioned);
    setDeletedRemote([]);
    setSelectedId(null);
  }, [topology]);

  // Build the React Flow node/edge model from the working tree.
  const apps = useMemo(() => workingTree.filter((n) => n.kind === "edge_app"), [workingTree]);

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = workingTree.map((n) => ({
      id: n.id,
      type: n.kind,
      position: n.position,
      data: {
        kind: n.kind,
        title: nodeTitle(n),
        subtitle: nodeSubtitle(n, topology),
        isNew: n.id.startsWith("new-"),
        isModified: isModified(n, topology),
      },
    }));
    const es: Edge[] = [];
    for (const node of workingTree) {
      if (node.kind === "workload") {
        const target = String((node.data as WorkloadData).edge_application_id ?? "");
        if (target) es.push({ id: `e-${node.id}-${target}`, source: target, target: node.id });
      }
      if (node.kind === "rule") {
        const target = String((node.data as RuleData).application_id ?? "");
        if (target) es.push({ id: `e-${node.id}-${target}`, source: target, target: node.id });
      }
    }
    return { nodes: ns, edges: es };
  }, [workingTree, topology]);

  /**
   * React Flow dispatches a stream of changes during drag. We only care about
   * position updates — everything else (selection, dimensions) is internal to
   * the canvas. Functional setState keeps us independent of stale `nodes`
   * references that recompute every render via useMemo.
   */
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setWorkingTree((prev) => {
      let next = prev;
      let touched = false;
      for (const ch of changes) {
        if (ch.type === "position" && ch.position) {
          touched = true;
          next = next.map((n) =>
            n.id === ch.id ? { ...n, position: ch.position! } : n,
          );
        }
      }
      return touched ? next : prev;
    });
  }, []);

  const onNodeClick = useCallback((_e: React.MouseEvent, n: Node) => {
    setSelectedId(n.id);
  }, []);

  /**
   * Edges are not stored directly — they reflect FKs on Domain / Rule. So
   * "connecting" two nodes means setting the target's foreign key:
   *   - app → workload : set workload.edge_application_id = app.id
   *   - app → rule   : set rule.application_id      = app.id
   * Anything else is rejected by isValidConnection upstream.
   */
  const onConnect = useCallback((c: Connection) => {
    setWorkingTree((prev) => {
      const source = prev.find((n) => n.id === c.source);
      const target = prev.find((n) => n.id === c.target);
      if (!source || !target || source.kind !== "edge_app") return prev;

      const sourceId: number | string = source.id.startsWith("new-")
        ? source.id
        : Number(source.id);

      return prev.map((n) => {
        if (n.id !== target.id) return n;
        if (n.kind === "workload") {
          return {
            ...n,
            data: { ...(n.data as WorkloadData), edge_application_id: sourceId },
          };
        }
        if (n.kind === "rule") {
          return {
            ...n,
            data: { ...(n.data as RuleData), application_id: sourceId },
          };
        }
        return n;
      });
    });
  }, []);

  /**
   * Deleting an edge clears the FK on the target. Domain/Rule visually become
   * orphan; the user will fail validation on Apply if they leave them empty.
   * Re-ordering / selection changes are no-ops here since edges are derived.
   */
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter((c): c is Extract<EdgeChange, { type: "remove" }> => c.type === "remove");
    if (removed.length === 0) return;
    const removedIds = new Set(removed.map((r) => r.id));
    setWorkingTree((prev) =>
      prev.map((n) => {
        if (n.kind === "workload") {
          const d = n.data as WorkloadData;
          const edgeId = `e-${n.id}-${String(d.edge_application_id ?? "")}`;
          if (removedIds.has(edgeId)) {
            return { ...n, data: { ...d, edge_application_id: "" } };
          }
        }
        if (n.kind === "rule") {
          const r = n.data as RuleData;
          const edgeId = `e-${n.id}-${String(r.application_id ?? "")}`;
          if (removedIds.has(edgeId)) {
            return { ...n, data: { ...r, application_id: "" } };
          }
        }
        return n;
      }),
    );
  }, []);

  const isValidConnection: IsValidConnection<Edge> = useCallback(
    (conn) => {
      const source = workingTree.find((n) => n.id === conn.source);
      const target = workingTree.find((n) => n.id === conn.target);
      if (!source || !target) return false;
      if (source.kind !== "edge_app") return false;
      return target.kind === "workload" || target.kind === "rule";
    },
    [workingTree],
  );

  const selectedNode = workingTree.find((n) => n.id === selectedId) ?? null;

  const changeSet = useChangeSet(topology, workingTree, deletedRemote);

  const onSaveNode = useCallback((next: WorkingNode) => {
    setWorkingTree((prev) => prev.map((n) => (n.id === next.id ? next : n)));
    setSelectedId(null);
  }, []);

  const onDeleteNode = useCallback((node: WorkingNode) => {
    if (node.id.startsWith("new-")) {
      // staged create → just discard locally
      setWorkingTree((prev) => prev.filter((n) => n.id !== node.id));
    } else {
      const id = Number(node.id);
      setDeletedRemote((prev) => [
        ...prev,
        { kind: node.kind, id, before: node.data },
      ]);
      setWorkingTree((prev) => prev.filter((n) => n.id !== node.id));
    }
    setSelectedId(null);
  }, []);

  const onAdd = useCallback(
    (kind: ResourceKind) => {
      const id = newLocalId();
      const data = defaultDataFor(kind, apps);
      const node: WorkingNode = {
        id,
        kind,
        data,
        position: { x: 80 + Math.random() * 120, y: 80 + Math.random() * 120 },
      };
      setWorkingTree((prev) => [...prev, node]);
      setSelectedId(id);
    },
    [apps],
  );

  const onReload = useCallback(() => {
    if (changeSet.length > 0) {
      if (!confirm(`Descartar ${changeSet.length} mudança(s) pendente(s)?`)) return;
    }
    void reload();
  }, [changeSet.length, reload]);

  const onApplySuccess = useCallback(() => {
    setApplyOpen(false);
    void reload();
  }, [reload]);

  const noAppsAvailable = apps.length === 0;
  const paletteDisabled = noAppsAvailable
    ? new Set<ResourceKind>(["workload", "rule"])
    : undefined;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border bg-background px-4 pb-5 pt-6 text-center">
        <h1 className="text-2xl font-light tracking-tight sm:text-3xl">
          Orquestre sua{" "}
          <span className="font-normal text-primary">conta Azion</span>.
        </h1>
      </div>
      <div className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-2">
        <button
          type="button"
          onClick={onReload}
          disabled={status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Reload
        </button>
        <div className="text-xs text-muted-foreground">
          {changeSet.length === 0
            ? "Sem mudanças pendentes"
            : `${changeSet.length} pending change${changeSet.length === 1 ? "" : "s"}`}
        </div>
        <button
          type="button"
          disabled={changeSet.length === 0}
          onClick={() => setApplyOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          <Wand2 size={13} />
          Apply{changeSet.length > 0 ? ` (${changeSet.length})` : ""}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <ResourcePalette onAdd={onAdd} disabledKinds={paletteDisabled} />
        <div className="relative min-w-0 flex-1">
          {status === "loading" && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-background/60 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Carregando infra…
              </span>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
              <div className="max-w-md text-sm text-danger">{error ?? "Erro ao carregar."}</div>
            </div>
          )}
          <Canvas
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            isValidConnection={isValidConnection}
          />
        </div>
      </div>

      <InspectorDrawer
        node={selectedNode}
        apps={apps.map((a) => ({
          id: a.id.startsWith("new-") ? a.id : Number(a.id),
          name: (a.data as EdgeAppData).name,
        }))}
        onSave={onSaveNode}
        onDelete={onDeleteNode}
        onClose={() => setSelectedId(null)}
      />

      <ApplyModal
        open={applyOpen}
        changes={changeSet}
        onClose={() => setApplyOpen(false)}
        onSuccess={onApplySuccess}
      />
    </div>
  );
}
