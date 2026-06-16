import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { getToken } from "@/lib/token-store";
import { cn } from "@/lib/utils";
import type { ApplyEvent, Change } from "./types";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string) ?? "http://localhost:3001";

type ItemStatus = "pending" | "running" | "ok" | "error";

type Props = {
  open: boolean;
  changes: Change[];
  onClose: () => void;
  onSuccess: () => void;
};

function describe(change: Change): string {
  const kindLabel: Record<Change["kind"], string> = {
    edge_app: "Application",
    workload: "Workload",
    edge_function: "Function",
    rule: "Rule",
  };
  const name =
    "data" in change
      ? (change.data as { name?: string }).name
      : "after" in change
        ? (change.after as { name?: string }).name
        : (change.before as { name?: string }).name;
  const op = change.op === "create" ? "Create" : change.op === "update" ? "Update" : "Delete";
  return `${op} ${kindLabel[change.kind]} · ${name ?? "—"}`;
}

export function ApplyModal({ open, changes, onClose, onSuccess }: Props) {
  const [statuses, setStatuses] = useState<ItemStatus[]>([]);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [doneOk, setDoneOk] = useState(false);

  const reset = useCallback(() => {
    setStatuses([]);
    setRunning(false);
    setErrorMsg(null);
    setDoneOk(false);
  }, []);

  async function start() {
    const token = await getToken();
    if (!token) {
      setErrorMsg("Configure seu Personal Token Azion antes de aplicar.");
      return;
    }
    setStatuses(changes.map(() => "pending"));
    setRunning(true);
    setErrorMsg(null);
    setDoneOk(false);

    try {
      const res = await fetch(`${SERVER_URL}/api/ops/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Azion-Token": token,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ changes }),
      });
      if (!res.ok || !res.body) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);
          const line = raw.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let ev: ApplyEvent;
          try {
            ev = JSON.parse(json) as ApplyEvent;
          } catch {
            continue;
          }
          if (ev.type === "progress") {
            setStatuses((prev) => {
              const next = [...prev];
              next[ev.index] = "running";
              return next;
            });
          } else if (ev.type === "result") {
            setStatuses((prev) => {
              const next = [...prev];
              next[ev.index] = ev.status;
              return next;
            });
            if (ev.status === "error") setErrorMsg(ev.message);
          } else if (ev.type === "done") {
            setDoneOk(true);
          } else if (ev.type === "error") {
            setErrorMsg(ev.message);
          }
        }
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function handleClose() {
    if (running) return; // can't close mid-apply
    if (doneOk) onSuccess();
    reset();
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-background shadow-popover">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-medium">
                Apply {changes.length} change{changes.length === 1 ? "" : "s"}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Executado em ordem de dependência. Para mid-flight, não fecha.
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={running}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="Fechar"
            >
              <X size={16} />
            </Dialog.Close>
          </header>

          <ul className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {changes.map((c, i) => {
              const s = statuses[i] ?? "pending";
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs",
                    s === "ok" && "border-success/30 bg-success/5",
                    s === "error" && "border-danger/40 bg-danger/10",
                    s === "running" && "border-primary/40 bg-primary/5",
                  )}
                >
                  <span className="w-4 text-muted-foreground">{i + 1}.</span>
                  <StatusIcon status={s} />
                  <span className="flex-1 truncate">{describe(c)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s}
                  </span>
                </li>
              );
            })}
          </ul>

          {errorMsg && (
            <div className="mx-3 mb-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {errorMsg}
            </div>
          )}

          <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
            <button
              type="button"
              disabled={running}
              onClick={handleClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              {doneOk ? "Fechar" : "Cancelar"}
            </button>
            {!doneOk && (
              <button
                type="button"
                disabled={running || changes.length === 0}
                onClick={start}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : null}
                Apply {changes.length} change{changes.length === 1 ? "" : "s"}
              </button>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "ok") return <CheckCircle2 size={14} className="text-success" />;
  if (status === "error") return <XCircle size={14} className="text-danger" />;
  if (status === "running") return <Loader2 size={14} className="animate-spin text-primary" />;
  return <span className="h-3.5 w-3.5 rounded-full border border-border" />;
}
