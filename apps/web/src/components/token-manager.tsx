import { useEffect, useState } from "react";
import { clearToken, hasStoredToken, setToken, tokenLast4 } from "@/lib/token-store";

type Props = { onConfigured: () => void };

export function TokenManager({ onConfigured }: Props) {
  const [stored, setStored] = useState<boolean>(hasStoredToken());
  const [last4, setLast4] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(!hasStoredToken());

  useEffect(() => {
    if (stored) void tokenLast4().then(setLast4);
  }, [stored]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    await setToken(input.trim());
    setInput("");
    setStored(true);
    setEditing(false);
    onConfigured();
  }

  function handleReset() {
    clearToken();
    setStored(false);
    setLast4(null);
    setEditing(true);
  }

  if (!editing && stored) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2 text-sm">
        <span>
          Token configurado <span className="text-muted-foreground">(…{last4 ?? "????"})</span>
        </span>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Trocar token
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/30 p-4">
      <label htmlFor="token" className="mb-1 block text-sm font-medium">
        Personal Token Azion
      </label>
      <p className="mb-3 text-xs text-muted-foreground">
        Cole seu token. Ele é criptografado (AES-GCM) no seu navegador e nunca é persistido no
        backend.
      </p>
      <div className="flex gap-2">
        <input
          id="token"
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="azion-personal-token..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
