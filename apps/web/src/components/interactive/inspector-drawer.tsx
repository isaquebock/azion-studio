import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  DomainData,
  EdgeAppData,
  EdgeFunctionData,
  RuleData,
  WorkingNode,
} from "./types";

type Props = {
  node: WorkingNode | null;
  apps: Array<{ id: number | string; name: string }>;
  onSave: (next: WorkingNode) => void;
  onDelete: (node: WorkingNode) => void;
  onClose: () => void;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

function inputClasses() {
  return cn(
    "w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm",
    "outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
  );
}

type Tab = "form" | "raw";

export function InspectorDrawer({ node, apps, onSave, onDelete, onClose }: Props) {
  const open = node != null;
  const [draft, setDraft] = useState<WorkingNode | null>(node);
  const [tab, setTab] = useState<Tab>("form");

  useEffect(() => {
    setDraft(node);
    setTab("form");
  }, [node]);

  if (!open || !draft) {
    return (
      <Dialog.Root open={false} onOpenChange={(v) => !v && onClose()}>
        <Dialog.Portal />
      </Dialog.Root>
    );
  }

  const isExisting = !draft.id.startsWith("new-");

  function updateData<K extends keyof (EdgeAppData & DomainData & EdgeFunctionData & RuleData)>(
    key: K,
    value: unknown,
  ) {
    setDraft((prev) =>
      prev ? { ...prev, data: { ...prev.data, [key]: value } as typeof prev.data } : prev,
    );
  }

  const kindLabel: Record<typeof draft.kind, string> = {
    edge_app: "Edge Application",
    domain: "Domain",
    edge_function: "Edge Function",
    rule: "Rule",
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-popover data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
        >
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold">
                {kindLabel[draft.kind]}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {isExisting ? `ID ${draft.id}` : "Novo recurso (não aplicado)"}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X size={16} />
            </Dialog.Close>
          </header>

          <nav className="flex gap-1 border-b border-border px-3 py-2">
            {(["form", "raw"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs transition-colors",
                  tab === t
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {t === "form" ? "Form" : "Raw JSON"}
              </button>
            ))}
          </nav>

          {tab === "raw" ? (
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <pre className="rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                {JSON.stringify(
                  (draft.data as { raw?: unknown }).raw ?? draft.data,
                  null,
                  2,
                )}
              </pre>
              <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                Read-only. Reflete o payload bruto vindo da API Azion no último load.
              </p>
            </div>
          ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <Label>Nome</Label>
              <input
                value={(draft.data as { name: string }).name}
                onChange={(e) => updateData("name", e.target.value)}
                className={inputClasses()}
                placeholder="Nome do recurso"
              />
            </div>

            {draft.kind === "edge_app" && (
              <div>
                <Label>Protocolo</Label>
                <select
                  value={(draft.data as EdgeAppData).delivery_protocol ?? "http,https"}
                  onChange={(e) => updateData("delivery_protocol", e.target.value)}
                  className={inputClasses()}
                >
                  <option value="http">HTTP</option>
                  <option value="http,https">HTTP + HTTPS</option>
                </select>
              </div>
            )}

            {draft.kind === "domain" && (
              <>
                <div>
                  <Label>Edge Application</Label>
                  <select
                    value={String((draft.data as DomainData).edge_application_id ?? "")}
                    onChange={(e) => updateData("edge_application_id", parseAppId(e.target.value))}
                    className={inputClasses()}
                  >
                    <option value="">— selecione —</option>
                    {apps.map((a) => (
                      <option key={String(a.id)} value={String(a.id)}>
                        {a.name} {typeof a.id === "string" && a.id.startsWith("new-") ? "(novo)" : `#${a.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>CNAMEs (um por linha)</Label>
                  <textarea
                    value={((draft.data as DomainData).cnames ?? []).join("\n")}
                    onChange={(e) =>
                      updateData(
                        "cnames",
                        e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    rows={3}
                    className={inputClasses()}
                    placeholder="cdn.exemplo.com"
                  />
                </div>
              </>
            )}

            {draft.kind === "edge_function" && (
              <div>
                <Label>Código</Label>
                <textarea
                  value={(draft.data as EdgeFunctionData).code}
                  onChange={(e) => updateData("code", e.target.value)}
                  rows={10}
                  className={cn(inputClasses(), "font-mono text-xs")}
                  placeholder="export default async function handler(request) { ... }"
                />
              </div>
            )}

            {draft.kind === "rule" && (
              <>
                <div>
                  <Label>Edge Application</Label>
                  <select
                    value={String((draft.data as RuleData).application_id ?? "")}
                    onChange={(e) => updateData("application_id", parseAppId(e.target.value))}
                    className={inputClasses()}
                  >
                    <option value="">— selecione —</option>
                    {apps.map((a) => (
                      <option key={String(a.id)} value={String(a.id)}>
                        {a.name} {typeof a.id === "string" && a.id.startsWith("new-") ? "(novo)" : `#${a.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Fase</Label>
                  <select
                    value={(draft.data as RuleData).phase}
                    onChange={(e) => updateData("phase", e.target.value as "request" | "response")}
                    className={inputClasses()}
                  >
                    <option value="request">request</option>
                    <option value="response">response</option>
                  </select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <input
                    value={(draft.data as RuleData).description ?? ""}
                    onChange={(e) => updateData("description", e.target.value)}
                    className={inputClasses()}
                  />
                </div>
              </>
            )}
          </div>
          )}

          <footer className="flex items-center gap-2 border-t border-border bg-muted/30 px-5 py-3">
            {isExisting && (
              <button
                type="button"
                onClick={() => onDelete(draft)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10"
              >
                <Trash2 size={14} />
                Remover
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Stage changes
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function parseAppId(value: string): number | string {
  if (value.startsWith("new-")) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}
