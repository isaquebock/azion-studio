import type { Change } from "./types.js";

/**
 * Order changes so dependencies are satisfied before dependents:
 *
 *   1. create edge_app          (apps are referenced by workloads and rules)
 *   2. create edge_function     (independent, but conventionally first)
 *   3. create workload / rule   (depend on app id)
 *   4. update *
 *   5. delete workload / rule   (drop dependents first)
 *   6. delete edge_function
 *   7. delete edge_app          (drop last)
 *
 * Within a bucket, preserve the user's input order so the UI's "Apply" list
 * matches what executes.
 */
const ORDER: Array<(c: Change) => boolean> = [
  (c) => c.op === "create" && c.kind === "edge_app",
  (c) => c.op === "create" && c.kind === "edge_function",
  (c) => c.op === "create" && (c.kind === "workload" || c.kind === "rule"),
  (c) => c.op === "update",
  (c) => c.op === "delete" && (c.kind === "workload" || c.kind === "rule"),
  (c) => c.op === "delete" && c.kind === "edge_function",
  (c) => c.op === "delete" && c.kind === "edge_app",
];

export function sortChanges(changes: Change[]): Change[] {
  const buckets: Change[][] = ORDER.map(() => []);
  const tail: Change[] = [];
  for (const change of changes) {
    const idx = ORDER.findIndex((pred) => pred(change));
    if (idx === -1) tail.push(change);
    else buckets[idx].push(change);
  }
  return [...buckets.flat(), ...tail];
}
