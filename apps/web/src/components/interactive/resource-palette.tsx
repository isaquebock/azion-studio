import { Code2, GitBranch, Globe2, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceKind } from "./types";

const ITEMS: Array<{ kind: ResourceKind; label: string; Icon: typeof Globe2 }> = [
  { kind: "edge_app", label: "Application", Icon: Layers },
  { kind: "domain", label: "Domain", Icon: Globe2 },
  { kind: "edge_function", label: "Function", Icon: Code2 },
  { kind: "rule", label: "Rule", Icon: GitBranch },
];

type Props = {
  onAdd: (kind: ResourceKind) => void;
  disabledKinds?: Set<ResourceKind>;
};

export function ResourcePalette({ onAdd, disabledKinds }: Props) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-border bg-background/80 p-3">
      <div className="px-1 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Add resource
      </div>
      {ITEMS.map(({ kind, label, Icon }) => {
        const disabled = disabledKinds?.has(kind);
        return (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(kind)}
            className={cn(
              "group flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm transition-colors",
              "hover:border-primary/60 hover:bg-muted",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-muted/40",
            )}
          >
            <Icon size={16} className="text-primary" />
            <span className="flex-1 text-foreground">{label}</span>
            <Plus size={14} className="text-muted-foreground group-hover:text-foreground" />
          </button>
        );
      })}
      <p className="mt-2 px-1 text-[11px] text-muted-foreground">
        Domains e Rules precisam de uma Application como destino.
      </p>
    </aside>
  );
}
