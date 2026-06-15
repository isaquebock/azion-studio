import { useState } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { AvatarMenu } from "@/components/avatar-menu";
import { hasStoredToken } from "@/lib/token-store";

/**
 * Top-level shell:
 *  - Logo (Azion orange arrow/triangle) anchored to the top-left.
 *  - Avatar menu (token management) anchored to the top-right.
 *  - ChatInterface fills the remaining space; it decides whether to render
 *    its centered empty state or the scrollable conversation layout.
 *
 * `hasToken` lives here only so the avatar's status dot can also notify the
 * shell (in case we ever need to gate behavior at this level). The chat
 * itself reads the token straight from `token-store` at send time.
 */
export function App() {
  const [, setHasToken] = useState<boolean>(hasStoredToken());

  return (
    <div className="relative flex h-full w-full flex-col bg-background text-foreground">
      {/* Top chrome — logo and avatar floated above the chat surface. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-2">
          <AzionLogo />
          <span className="sr-only">Azion Chat</span>
        </div>
        <div className="pointer-events-auto">
          <AvatarMenu onTokenChange={setHasToken} />
        </div>
      </header>

      {/* Chat surface fills the viewport; padding-top reserves room for the
          floating header so content never slides under the logo/avatar. */}
      <main className="flex min-h-0 flex-1 pt-14">
        <ChatInterface />
      </main>
    </div>
  );
}

/** Simple inline-SVG Azion mark — orange arrow/triangle. No image asset. */
function AzionLogo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Azion"
      role="img"
    >
      {/* Filled triangle pointing right, evoking the Azion arrow mark. */}
      <path d="M4 3 L20 12 L4 21 Z" fill="#F3652B" />
    </svg>
  );
}
