import { Suspense } from "react";
import type { Metadata } from "next";

import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";

export const metadata: Metadata = {
  title: "Verify email | Digital Wealth Vault",
};

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <VerifyEmailPanel />
      </Suspense>
    </div>
  );
}
