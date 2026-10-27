import type { Metadata } from "next";

import { requireSession } from "@/lib/session";
import { VaultChat } from "@/components/chat/vault-chat";

export const instant = false;

export const metadata: Metadata = {
  title: "AI Vault | Digital Wealth Vault",
};

export default async function VaultChatPage() {
  const session = await requireSession();
  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Digital Wealth Vault
          </p>
          <h1 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            AI Vault Chat
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Answers are grounded in the assets saved in your vault — saved
            valuations, never live market prices.
          </p>
        </div>
      </div>

      <VaultChat userName={firstName || undefined} />
    </div>
  );
}
