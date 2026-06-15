import { useEffect, useState } from "react";
import type { Risk } from "@/lib/tool-risk";
import { cn } from "@/lib/utils";

export type ConfirmRequest = {
  toolName: string;
  args: unknown;
  risk: Risk;
  resolve: (ok: boolean) => void;
};

type Props = { request: ConfirmRequest | null };

export function ConfirmDialog({ request }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(Boolean(request)), [request]);

  if (!request || !open) return null;

  const isDestructive = request.risk === "destructive";
  const title = isDestructive
    ? "Confirmar operação destrutiva"
    : "Confirmar operação de escrita";

  function decide(ok: boolean) {
    request?.resolve(ok);
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full max-w-lg rounded-lg border bg-background p-5 shadow-xl",
          isDestructive ? "border-red-500/60" : "border-amber-500/60",
        )}
      >
        <h2
          className={cn(
            "text-lg font-semibold",
            isDestructive ? "text-red-600" : "text-amber-700",
          )}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O assistente quer executar <code className="rounded bg-muted px-1">{request.toolName}</code>.
        </p>
        <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
{JSON.stringify(request.args, null, 2)}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-white",
              isDestructive ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700",
            )}
          >
            {isDestructive ? "Sim, deletar" : "Executar"}
          </button>
        </div>
      </div>
    </div>
  );
}
