import Link from "next/link";
import {
  ArrowRight,
  Bitcoin,
  Check,
  Cloud,
  Globe,
  Key,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { categoryLabel } from "@/lib/asset-schemas";
import { formatMoney } from "@/lib/currency";

export const instant = false;

const previewAssets = [
  { icon: Bitcoin, category: "CRYPTO", title: "Hardware wallet", value: 41200, currency: "USD", auth: "Authorized" },
  { icon: Globe, category: "DOMAIN", title: "Family domain", value: 18, currency: "USD", auth: "Authorized" },
  { icon: TrendingUp, category: "INVESTMENT", title: "Brokerage account", value: 1457700, currency: "INR", auth: "Requested" },
  { icon: Cloud, category: "CLOUD_STORAGE", title: "Photo archive drive", value: 9.99, currency: "USD", auth: "Authorized" },
  { icon: Key, category: "SOFTWARE_LICENSE", title: "Licence bundle", value: 250, currency: "USD", auth: "Requested" },
] as const;

const howItWorks = [
  {
    icon: ScrollText,
    step: "01",
    title: "Record your digital assets",
    body: "Add wallets, domains, investments and licences with an estimate in each currency — everything you own, in one place.",
  },
  {
    icon: UserCheck,
    step: "02",
    title: "Choose trusted nominees",
    body: "Invite the people who should know, and decide which assets each nominee is authorized to see before any release.",
  },
  {
    icon: ShieldCheck,
    step: "03",
    title: "Keep it current with check-ins",
    body: "A simple check-in keeps you actively involved. Your records stay organized while plans change.",
  },
] as const;

export default async function Home() {
  const session = await getSession();
  const signedIn = Boolean(session?.user);

  return (
    <div className="relative flex min-h-svh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent)_0%,transparent_100%)]"
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
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Create your vault</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* 1. Hero */}
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-20 pt-36 sm:px-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-16 lg:pt-40">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Digital estate, held with care
            </p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Your digital life deserves a plan.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Digital Wealth Vault helps you document your digital assets,
              organize the information your loved ones would need, and prepare
              trusted nominees for what comes next — calmly, clearly, and on
              your terms.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
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
                      Create your vault
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="min-w-40">
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="min-w-40">
                    <a href="#how-it-works">Explore how it works</a>
                  </Button>
                </>
              )}
            </div>
            <p className="mt-8 text-xs text-muted-foreground">
              Valuations shown are fictional prototype samples. Not financial
              advice.
            </p>
          </div>

          {/* 2. Product preview — faithful composition of the real dashboard */}
          <div className="relative rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <p className="text-sm font-medium">Wealth overview</p>
              <Badge variant="secondary" className="text-xs">
                Illustrative
              </Badge>
            </div>
            <div className="space-y-3 px-5 py-4">
              {previewAssets.map((asset) => (
                <div
                  key={asset.title}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <asset.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block truncate font-medium">
                      {asset.title}
                    </span>
                    <span className="text-muted-foreground">
                      {categoryLabel(asset.category)}
                    </span>
                  </span>
                  <span className="text-right text-xs">
                    <span className="block font-medium tabular-nums">
                      {formatMoney(asset.value, asset.currency)}
                    </span>
                    <span
                      className={
                        asset.auth === "Authorized"
                          ? "text-sm text-muted-foreground"
                          : "text-xs text-amber-600"
                      }
                    >
                      {asset.auth}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span>Values kept separate by currency</span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" />
                Check-in up to date
              </span>
            </div>
          </div>
        </section>

        {/* 3. Why it matters */}
        <section
          aria-labelledby="why-it-matters"
          className="border-y border-border bg-card/60"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Why it matters
            </p>
            <h2
              id="why-it-matters"
              className="mt-3 max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              The accounts we live by are hard to find when we&apos;re not here.
            </h2>
            <div className="mt-10 grid gap-10 sm:grid-cols-3">
              <div>
                <p className="font-heading text-lg font-semibold tracking-tight">
                  Assets stay scattered
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Valuable online accounts live across dozens of providers.
                  Nobody memorizes where everything is — and files in one
                  person&apos;s head disappear with them.
                </p>
              </div>
              <div>
                <p className="font-heading text-lg font-semibold tracking-tight">
                  Information lives in fragments
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  What you own, where it&apos;s held, and what it&apos;s worth
                  rarely written down in one place — leaving loved ones to
                  piece it together on the hardest week of their lives.
                </p>
              </div>
              <div>
                <p className="font-heading text-lg font-semibold tracking-tight">
                  A plan helps trusted people act
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  When records are organized and nominees are chosen, the
                  people you trust can see what exists and know what to do
                  next — without inventing or guessing.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-title"
          className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6"
        >
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            How it works
          </p>
          <h2
            id="how-it-works-title"
            className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Three steps, kept deliberately simple
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {howItWorks.map((item) => (
              <li key={item.step} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <item.icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                    Step {item.step}
                  </span>
                </div>
                <p className="mt-4 font-heading text-lg font-semibold tracking-tight">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* 5. Privacy and trust */}
        <section
          aria-labelledby="privacy-trust"
          className="border-y border-border bg-card/60"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
            <div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
              <h2
                id="privacy-trust"
                className="mt-5 font-heading text-3xl font-semibold tracking-tight text-balance"
              >
                Private by design, honest about limits
              </h2>
            </div>
            <ul className="space-y-5 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">
                    Only you can see your records.
                  </strong>{" "}
                  Every asset, nominee, and request is owned by your verified
                  account, and server-side ownership checks are enforced on
                  every read and write.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">
                    Nominees see only what you authorize.
                  </strong>{" "}
                  An invited nominee gains nothing until you authorize them
                  asset by asset — and full access follows a deliberate,
                  time-gated release process.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">
                    Never store passwords or secrets.
                  </strong>{" "}
                  Record what your nominees need to know, never credentials —
                  recovery codes, seed phrases, or keys shouldn&apos;t be typed
                  into asset notes.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">
                    A prototype, said plainly.
                  </strong>{" "}
                  This is an academic prototype: it is not audited,
                  end-to-end-encrypted, or legally certified, and transfer
                  rules depend on each provider&apos;s terms — the vault keeps
                  your information ready, then the right people decide.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* 6. Final CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="mx-auto max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Put it in order once — keep it ready for the people you chose.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
                    Create your vault
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-40">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>Digital Wealth Vault · Academic prototype</p>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="transition-colors hover:text-foreground">
              Create your vault
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
