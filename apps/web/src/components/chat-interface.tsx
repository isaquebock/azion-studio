import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/token-store";
import { cn } from "@/lib/utils";
import { MessageBubble, type ChatMessage } from "./message-bubble";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string) ?? "http://localhost:3001";

type SseEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; result: unknown; is_error?: boolean }
  | { type: "done" }
  | { type: "error"; message: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Single-component chat surface. Renders in two visual modes driven purely by
 * `messages.length`:
 *
 *  - **empty**: greeting + input centered vertically (ChatGPT-like landing).
 *  - **conversation**: scrollable history fills available space, input pinned
 *    to the bottom of the column.
 *
 * The streaming pipeline (SSE reader, rAF-coalesced text flush, memoized
 * bubbles, `isStreaming` flag) is unchanged from the previous revision —
 * only the surrounding layout was reworked.
 */
export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [confirmReq] = useState<ConfirmRequest | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);

  // Coalesce token deltas into a single React update per animation frame.
  const pendingTextRef = useRef<Map<string, string>>(new Map());
  const rafRef = useRef<number | null>(null);

  const flushPendingText = useCallback(() => {
    rafRef.current = null;
    const pending = pendingTextRef.current;
    if (pending.size === 0) return;
    const snapshot = new Map(pending);
    pending.clear();
    setMessages((prev) =>
      prev.map((m) => {
        const extra = snapshot.get(m.id);
        return extra ? { ...m, text: m.text + extra } : m;
      }),
    );
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flushPendingText);
  }, [flushPendingText]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Use instant scroll during streaming to avoid smooth-scroll animations
    // competing with re-renders on every token.
    el.scrollTo({
      top: el.scrollHeight,
      behavior: isStreamingRef.current ? "auto" : "smooth",
    });
  }, [messages]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const token = await getToken();
    if (!token) {
      alert("Configure o Personal Token primeiro (avatar no canto superior direito).");
      return;
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", text };
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", text: "", toolCalls: [] };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    isStreamingRef.current = true;
    setStreamingId(assistantMsg.id);

    // build payload from prior + new user msg (assistant placeholder not sent)
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.text }));

    try {
      const res = await fetch(`${SERVER_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Azion-Token": token,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
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
          const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          let ev: SseEvent;
          try {
            ev = JSON.parse(json) as SseEvent;
          } catch {
            continue;
          }

          if (ev.type === "text") {
            const prev = pendingTextRef.current.get(assistantMsg.id) ?? "";
            pendingTextRef.current.set(assistantMsg.id, prev + ev.delta);
            scheduleFlush();
          } else if (ev.type === "tool_call") {
            // Flush any pending text before structural change to keep order.
            if (rafRef.current != null) {
              cancelAnimationFrame(rafRef.current);
              flushPendingText();
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      toolCalls: [
                        ...(m.toolCalls ?? []),
                        { id: ev.id, name: ev.name, input: ev.input },
                      ],
                    }
                  : m,
              ),
            );
          } else if (ev.type === "tool_result") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      toolCalls: m.toolCalls?.map((tc) =>
                        tc.id === ev.id ? { ...tc, result: ev.result, isError: ev.is_error } : tc,
                      ),
                    }
                  : m,
              ),
            );
          } else if (ev.type === "error") {
            if (rafRef.current != null) {
              cancelAnimationFrame(rafRef.current);
              flushPendingText();
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, text: (m.text || "") + `\n\n⚠️ ${ev.message}` }
                  : m,
              ),
            );
          } else if (ev.type === "done") {
            // no-op
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, text: `⚠️ ${(err as Error).message}` } : m,
        ),
      );
    } finally {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        flushPendingText();
      }
      isStreamingRef.current = false;
      setStreaming(false);
      setStreamingId(null);
    }
  }

  const isEmpty = messages.length === 0;

  // Composer is the same in both modes; layout is what changes.
  const composer = (
    <form onSubmit={send} className={cn("w-full", isEmpty ? "" : "")}>
      <div className="flex items-end gap-2 border border-border bg-muted p-2 focus-within:ring-2 focus-within:ring-primary/30">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre sua conta Azion..."
          disabled={isStreaming}
          className="flex-1 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className=" bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {isStreaming ? "…" : "Enviar"}
        </button>
      </div>
    </form>
  );

  if (isEmpty) {
    // Centered landing: greeting + composer stacked, vertically centered.
    return (
      <div className="flex h-full w-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-[720px]">
          <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Como posso ajudar com sua{" "}
            <span className="text-primary">conta Azion</span>?
          </h1>
          {composer}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Ex.: <em>“liste minhas edge applications”</em>
          </p>
        </div>
        <ConfirmDialog request={confirmReq} />
      </div>
    );
  }

  // Conversation mode: scrollable history + pinned composer.
  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex h-full w-full max-w-[720px] flex-col">
        <div
          ref={scrollerRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-6"
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} isStreaming={m.id === streamingId} />
          ))}
        </div>
        <div className="border-border bg-background px-6 py-4">
          {composer}
        </div>
      </div>
      <ConfirmDialog request={confirmReq} />
    </div>
  );
}
