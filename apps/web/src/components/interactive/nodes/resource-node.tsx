import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Globe2, Layers, Code2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceKind } from "../types";

/**
 * Single resource-node renderer parameterised by `kind`. Visual differences
 * (icon, accent color, default subtitle) are looked up from CONFIG; layout
 * and selection behavior are identical across kinds, which keeps the React
 * Flow node registry small and the diff between kinds reviewable at a glance.
 */
const CONFIG: Record<
  ResourceKind,
  { Icon: typeof Globe2; label: string }
> = {
  edge_app: { Icon: Layers, label: "Application" },
  domain: { Icon: Globe2, label: "Domain" },
  edge_function: { Icon: Code2, label: "Function" },
  rule: { Icon: GitBranch, label: "Rule" },
};

export type ResourceNodeData = {
  kind: ResourceKind;
  title: string;
  subtitle?: string;
  isNew?: boolean;
  isModified?: boolean;
};

function ResourceNodeImpl(props: NodeProps) {
  const data = props.data as unknown as ResourceNodeData;
  const { Icon, label } = CONFIG[data.kind];
  const accent = data.isNew
    ? "border-dashed border-primary/70"
    : data.isModified
      ? "border-primary/80"
      : "border-border";
  return (
    <div
      className={cn(
        "flex w-[220px] items-center gap-3 rounded-xl border bg-muted/95 px-3 py-2.5 shadow-popover transition-colors",
        accent,
        props.selected && "ring-2 ring-primary/60",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-4 !w-4 !-left-2 !border-2 !border-background !bg-primary hover:!bg-primary/80"
      />
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-background text-primary">
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium text-foreground">{data.title || "—"}</div>
        {data.subtitle ? (
          <div className="truncate text-[11px] text-muted-foreground">{data.subtitle}</div>
        ) : null}
      </div>
      {data.isNew ? (
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
          new
        </span>
      ) : data.isModified ? (
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
          edit
        </span>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-4 !w-4 !-right-2 !border-2 !border-background !bg-primary hover:!bg-primary/80"
      />
    </div>
  );
}

export const ResourceNode = memo(ResourceNodeImpl);
