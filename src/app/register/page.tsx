import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { isGoogleConfigured } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register | Digital Wealth Vault",
};

export default async function RegisterPage() {
  return (
    <div className="relative flex min-h-svh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,var(--accent)_0%,transparent_100%)]"
      />
      <div className="absolute top-6 w-full px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to vault
          </Link>
          <span className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
            <ShieldCheck className="size-4 text-primary" />
            Digital Wealth Vault
          </span>
        </div>
      </div>
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <Suspense>
          <RegisterForm googleEnabled={isGoogleConfigured} />
        </Suspense>
      </main>
    </div>
  );
}
