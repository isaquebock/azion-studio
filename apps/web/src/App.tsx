import { useState } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { TokenManager } from "@/components/token-manager";
import { hasStoredToken } from "@/lib/token-store";

export function App() {
  const [hasToken, setHasToken] = useState<boolean>(hasStoredToken());

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Azion Chat</h1>
        <span className="text-xs text-muted-foreground">MCP · Personal Token local</span>
      </header>

      <TokenManager onConfigured={() => setHasToken(true)} />

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        {hasToken ? (
          <ChatInterface />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Configure seu Personal Token Azion acima para começar.
          </div>
        )}
      </div>
    </div>
  );
}
