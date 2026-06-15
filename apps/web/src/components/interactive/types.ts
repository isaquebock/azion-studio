// Mirror of apps/server/src/ops/types.ts. Kept in sync by hand — small surface.

export type ResourceKind = "edge_app" | "domain" | "edge_function" | "rule";

export type EdgeAppData = {
  id?: number;
  name: string;
  delivery_protocol?: "http" | "http,https";
  /** Full untouched API payload (read-only, for the inspector's Raw tab). */
  raw?: unknown;
};

export type DomainData = {
  id?: number;
  name: string;
  cname_access_only?: boolean;
  cnames?: string[];
  edge_application_id: number | string;
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
  criteria?: unknown;
  behaviors?: unknown;
  raw?: unknown;
};

export type ResourceFor<K extends ResourceKind> = K extends "edge_app"
  ? EdgeAppData
  : K extends "domain"
    ? DomainData
    : K extends "edge_function"
      ? EdgeFunctionData
      : K extends "rule"
        ? RuleData
        : never;

export type Topology = {
  apps: EdgeAppData[];
  domains: DomainData[];
  functions: EdgeFunctionData[];
  rules: RuleData[];
};

/**
 * Working-tree entry: every node lives here, real or pending.
 *  - `id`: numeric for existing resources, "new-xxx" for staged creates.
 *  - `kind`: which Azion resource shape `data` carries.
 *  - `data`: current field values (edited by the inspector).
 *  - `position`: canvas coordinates (set by dagre on first render, then by drag).
 */
export type WorkingNode = {
  id: string;
  kind: ResourceKind;
  data: EdgeAppData | DomainData | EdgeFunctionData | RuleData;
  position: { x: number; y: number };
};

export type Change =
  | { op: "create"; kind: ResourceKind; localId: string; data: EdgeAppData | DomainData | EdgeFunctionData | RuleData }
  | { op: "update"; kind: ResourceKind; id: number; before: EdgeAppData | DomainData | EdgeFunctionData | RuleData; after: EdgeAppData | DomainData | EdgeFunctionData | RuleData }
  | { op: "delete"; kind: ResourceKind; id: number; before: EdgeAppData | DomainData | EdgeFunctionData | RuleData };

export type ApplyEvent =
  | { type: "progress"; index: number; total: number; change: Change; status: "running" }
  | { type: "result"; index: number; change: Change; status: "ok"; createdId?: number }
  | { type: "result"; index: number; change: Change; status: "error"; message: string }
  | { type: "done" }
  | { type: "error"; message: string };
