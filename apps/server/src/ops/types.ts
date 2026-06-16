// Shared types for /api/ops/* — kept in sync manually with the frontend copy
// at apps/web/src/components/interactive/types.ts. Small surface, low churn.

export type ResourceKind = "edge_app" | "workload" | "edge_function" | "rule";

export type EdgeAppData = {
  id?: number;
  name: string;
  delivery_protocol?: "http" | "http,https";
  /** Full untouched API payload (read-only, for the inspector's Raw tab). */
  raw?: unknown;
};

export type WorkloadData = {
  id?: number;
  name: string;
  cname_access_only?: boolean;
  cnames?: string[];
  edge_application_id: number | string; // string while it's still a local placeholder
  digital_certificate_id?: number | null;
  raw?: unknown;
};

export type EdgeFunctionData = {
  id?: number;
  name: string;
  code: string;
  language?: "javascript";
  initiator_type?: "edge_application" | "edge_firewall";
  raw?: unknown;
};

export type RuleData = {
  id?: number;
  name: string;
  application_id: number | string;
  phase: "request" | "response";
  description?: string;
  // The full rules-engine schema is rich; v1 stores opaque criteria/behaviors
  // and round-trips them. The form only edits name/description.
  criteria?: unknown;
  behaviors?: unknown;
  raw?: unknown;
};

export type ResourceData =
  | { kind: "edge_app"; data: EdgeAppData }
  | { kind: "workload"; data: WorkloadData }
  | { kind: "edge_function"; data: EdgeFunctionData }
  | { kind: "rule"; data: RuleData };

export type Topology = {
  apps: EdgeAppData[];
  workloads: WorkloadData[];
  functions: EdgeFunctionData[];
  rules: RuleData[];
};

export type Change =
  | { op: "create"; kind: ResourceKind; localId: string; data: ResourceFor<ResourceKind> }
  | { op: "update"; kind: ResourceKind; id: number; before: ResourceFor<ResourceKind>; after: ResourceFor<ResourceKind> }
  | { op: "delete"; kind: ResourceKind; id: number; before: ResourceFor<ResourceKind> };

export type ResourceFor<K extends ResourceKind> = K extends "edge_app"
  ? EdgeAppData
  : K extends "workload"
    ? WorkloadData
    : K extends "edge_function"
      ? EdgeFunctionData
      : K extends "rule"
        ? RuleData
        : never;

export type ApplyEvent =
  | { type: "progress"; index: number; total: number; change: Change; status: "running" }
  | { type: "result"; index: number; change: Change; status: "ok"; createdId?: number }
  | { type: "result"; index: number; change: Change; status: "error"; message: string }
  | { type: "done" }
  | { type: "error"; message: string };
