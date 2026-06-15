import { cn } from "@/lib/utils";

export type AppMode = "interactive" | "ai";

type Props = {
  value: AppMode;
  onChange: (mode: AppMode) => void;
};

const MODES: Array<{ id: AppMode; label: string }> = [
  { id: "interactive", label: "Interactive Mode" },
  { id: "ai", label: "AI Mode" },
];

export function ModeSwitcher({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Modo do Azion Studio"
      className="inline-flex items-center rounded-full border border-border bg-muted/60 p-1 text-xs font-medium backdrop-blur"
    >
      {MODES.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
