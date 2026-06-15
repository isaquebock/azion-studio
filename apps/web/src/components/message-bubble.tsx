import { memo } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: unknown;
    result?: unknown;
    isError?: boolean;
  }>;
};

function TypingDots() {
  const dotStyle: React.CSSProperties = {
    animation: "chatdot 1s ease-in-out infinite",
  };
  return (
    <div
      className="flex items-center gap-1 py-1"
      role="status"
      aria-label="Assistente digitando"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
        style={dotStyle}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
        style={{ ...dotStyle, animationDelay: "0.15s" }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
        style={{ ...dotStyle, animationDelay: "0.3s" }}
      />
    </div>
  );
}

function MessageBubbleImpl({
  message,
  isStreaming = false,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-6 py-4 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "border border-neutral-800 bg-muted",
        )}
      >
        {message.text ? (
          isUser || isStreaming ? (
            // While streaming, skip the markdown parser (re-parses entire text on every token).
            // Final render after stream ends will re-parse once into rich markdown.
            <div className="whitespace-pre-wrap">{message.text}</div>
          ) : (
            <Markdown>{message.text}</Markdown>
          )
        ) : isStreaming && !isUser ? (
          <TypingDots />
        ) : null}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl, (prev, next) => {
  if (prev.isStreaming !== next.isStreaming) return false;
  const a = prev.message;
  const b = next.message;
  if (a === b) return true;
  if (a.id !== b.id || a.role !== b.role || a.text !== b.text) return false;
  const at = a.toolCalls ?? [];
  const bt = b.toolCalls ?? [];
  if (at.length !== bt.length) return false;
  for (let i = 0; i < at.length; i++) {
    const x = at[i];
    const y = bt[i];
    if (x.id !== y.id || x.result !== y.result || x.isError !== y.isError) return false;
  }
  return true;
});
