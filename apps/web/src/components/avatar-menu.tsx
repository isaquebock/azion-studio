import { useEffect, useRef, useState } from "react";
import {
  clearToken,
  hasStoredToken,
  setToken,
  tokenLast4,
} from "@/lib/token-store";
import { cn } from "@/lib/utils";

type Props = {
  /** Notifies the parent whenever the stored-token state flips. */
  onTokenChange?: (hasToken: boolean) => void;
};

/**
 * Avatar in the top-right corner with a click-to-open dropdown that manages
 * the Personal Token (set / replace / remove). Replaces the legacy
 * `TokenManager` block that used to live in the main layout.
 *
 * Implementation notes:
 * - No Radix / Headless UI — just useState + useRef + a document click-outside
 *   listener, to keep the bundle lean.
 * - Token I/O still goes through `lib/token-store` (AES-GCM, session-bound key).
 */
export function AvatarMenu({ onTokenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<boolean>(hasStoredToken());
  const [last4, setLast4] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Refresh the last-4 preview whenever the token state flips.
  useEffect(() => {
    if (!stored) {
      setLast4(null);
      return;
    }
    let alive = true;
    void tokenLast4().then((v) => {
      if (alive) setLast4(v);
    });
    return () => {
      alive = false;
    };
  }, [stored]);

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await setToken(v);
      setInput("");
      setStored(true);
      onTokenChange?.(true);
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    clearToken();
    setStored(false);
    setLast4(null);
    onTokenChange?.(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={stored ? "Conta — token configurado" : "Conta — sem token"}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground/90 transition hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <span className="select-none">AZ</span>
        {/* Status dot — green when token is configured, neutral grey when not. */}
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
            stored ? "bg-success" : "bg-muted-foreground/60",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-border bg-muted p-4 shadow-popover"
        >
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full",
                stored ? "bg-success" : "bg-muted-foreground/60",
              )}
            />
            <span className="font-medium">
              {stored ? "Token configurado" : "Sem token"}
            </span>
            {stored && last4 && (
              <span className="text-xs text-muted-foreground">…{last4}</span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-2">
            <label
              htmlFor="azion-token"
              className="block text-xs text-muted-foreground"
            >
              Personal Token Azion
            </label>
            <input
              id="azion-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={stored ? "Cole um novo token para trocar" : "azion-personal-token..."}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Criptografado (AES-GCM) no navegador; nunca persistido no backend.
            </p>
            <div className="flex items-center justify-between gap-2 pt-1">
              {stored ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-danger hover:underline"
                >
                  Remover token
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
