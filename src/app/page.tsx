import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

export const instant = false;

export default async function Home() {
  const session = await getSession();
  const signedIn = Boolean(session?.user);

  return (
    <div className="relative flex min-h-svh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent)_0%,transparent_100%)]"
      />

      <header className="absolute inset-x-0 top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4.5" />
            </span>
            <span className="font-heading text-sm font-semibold tracking-tight">
              Digital Wealth Vault
            </span>
          </Link>
          {signedIn ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">
                Open dashboard
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-24 sm:px-6">
        <section className="w-full max-w-2xl text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Digital estate, held with care
          </p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            One vault for your digital
            <br className="hidden sm:block" /> wealth — and the people
            <br className="hidden sm:block" /> who inherit it
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Organize your digital assets and estimated values, keep recovery
            guidance where your family can find it, and authorize nominees —
            with a controlled inheritance flow that never presumes.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {signedIn ? (
              <Button asChild size="lg" className="min-w-40">
                <Link href="/dashboard">
                  Open your vault
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="min-w-40">
                  <Link href="/register">
                    Get started
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-40">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            Fictional prototype valuations. Not financial advice.
          </p>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <p>Digital Wealth Vault · Academic prototype</p>
        </div>
      </footer>
    </div>
  );
}
