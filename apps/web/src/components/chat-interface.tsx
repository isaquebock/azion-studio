import { useMemo, useEffect, useRef, useState } from "react";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { getToken } from "@/lib/token-store";
import { cn } from "@/lib/utils";
import { MessageBubble, type ChatMessage } from "./message-bubble";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string) ?? "http://localhost:3001";

/**
 * Chat surface backed by TanStack AI's `useChat`. Connection is an SSE adapter
 * pointed at the Express server, with the user's Azion token injected per-send
 * via the async header resolver.
 *
 * Visual modes are still driven by `messages.length`: empty → centered landing,
 * non-empty → scrollable history + pinned composer.
 */
export function ChatInterface() {
  const [input, setInput] = useState("");
  const [confirmReq] = useState<ConfirmRequest | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const connection = useMemo(
    () =>
      fetchServerSentEvents(`${SERVER_URL}/api/chat`, async () => {
        const token = await getToken();
        return {
          headers: {
            "Content-Type": "application/json",
            "X-Azion-Token": token ?? "",
            Accept: "text/event-stream",
          },
        };
      }),
    [],
  );

  const { messages, sendMessage, isLoading, error } = useChat({ connection });

  // Adapt TanStack AI's UIMessage[] into the existing MessageBubble shape.
  // Concatenates text parts; tool-call parts are not rendered (mirrors the
  // previous behavior, where the bubble already ignored tool calls visually).
  const adapted: ChatMessage[] = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          text: m.parts
            .filter((p) => p.type === "text")
            .map((p) => ("content" in p ? String(p.content ?? "") : ""))
            .join(""),
        })),
    [messages],
  );

  const streamingId = isLoading
    ? [...adapted].reverse().find((m) => m.role === "assistant")?.id ?? null
    : null;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: isLoading ? "auto" : "smooth",
    });
  }, [adapted, isLoading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const token = await getToken();
    if (!token) {
      alert("Configure o Personal Token primeiro (avatar no canto superior direito).");
      return;
    }

    setInput("");
    await sendMessage(text);
  }

  const isEmpty = adapted.length === 0;

  const composer = (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex items-end gap-2 border border-border bg-muted p-2 focus-within:ring-2 focus-within:ring-primary/30">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre sua conta Azion..."
          disabled={isLoading}
          className="flex-1 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className=" bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {isLoading ? "…" : "Enviar"}
        </button>
      </div>
    </form>
  );

  if (isEmpty) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-[720px]">
          <h1 className="mb-8 text-center text-3xl font-light tracking-tight sm:text-4xl">
            Converse com sua{" "}
            <span className="font-normal text-primary">conta Azion</span>.
          </h1>
          {composer}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Ex.: <em>“liste minhas applications”</em>
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-center text-xs text-destructive">
              ⚠️ {error.message}
            </p>
          ) : null}
        </div>
        <ConfirmDialog request={confirmReq} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex h-full w-full max-w-[720px] flex-col">
        <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-6">
          {adapted.map((m) => (
            <MessageBubble key={m.id} message={m} isStreaming={m.id === streamingId} />
          ))}
          {error ? (
            <div role="alert" className="text-xs text-destructive">
              ⚠️ {error.message}
            </div>
          ) : null}
        </div>
        <div className="border-border bg-background px-6 py-4">{composer}</div>
      </div>
      <ConfirmDialog request={confirmReq} />
    </div>
  );
}
