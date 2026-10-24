import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  FileCheck2,
  Fingerprint,
  Hourglass,
  IndianRupee,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const features = [
  {
    icon: Boxes,
    title: "Asset inventory",
    description:
      "Catalog crypto, domains, cloud storage, gaming items, and investment accounts with masked references — never raw credentials.",
  },
  {
    icon: IndianRupee,
    title: "Estimated values in ₹",
    description:
      "Track fictional estimated values per asset in INR by default, with per-asset currency stored for future flexibility.",
  },
  {
    icon: KeyRound,
    title: "Recovery guidance",
    description:
      "Store where ownership evidence lives and the step-by-step recovery procedure — descriptions only, never secrets themselves.",
  },
  {
    icon: BookOpenCheck,
    title: "Official selling guides",
    description:
      "Per-asset selling steps and eligibility notes that always defer to provider policy, with direct links to official sites.",
  },
  {
    icon: Users,
    title: "Nominees & authorization",
    description:
      "Grant named nominees asset-specific, revocable access. Every permission check runs on the server.",
  },
  {
    icon: Hourglass,
    title: "Simulated inheritance",
    description:
      "A testable handoff flow with reminders, a grace window, and identity reconfirmation — inactivity alone never grants access.",
  },
] as const;

const steps = [
  {
    step: "01",
    title: "Inventory your vault",
    description:
      "Add digital assets with provider details, valuation basis, and recovery instructions.",
  },
  {
    step: "02",
    title: "Nominate & authorize",
    description:
      "Invite nominees and choose exactly which assets each one may access.",
  },
  {
    step: "03",
    title: "Controlled handoff",
    description:
      "After prolonged inactivity, nominees must verify identity before any release — you can revoke at any time.",
  },
] as const;

const securityPoints = [
  {
    icon: Fingerprint,
    title: "No third-party secrets stored",
    description:
      "Account passwords, private keys, and crypto seed phrases are rejected by input validation — the vault only holds references and procedures.",
  },
  {
    icon: ShieldCheck,
    title: "Server-side authorization",
    description:
      "Every private page, query, and mutation re-verifies the session and ownership on the server before returning data.",
  },
  {
    icon: FileCheck2,
    title: "Inactivity is not death",
    description:
      "Missed check-ins only trigger reminders and a verification flow. Nothing in the system ever presumes a death or auto-releases access.",
  },
] as const;

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.95_0.01_260)_0%,transparent_100%)]"
      />

      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4.5" />
            </span>
            <span className="font-heading text-sm font-semibold tracking-tight">
              Digital Wealth Vault
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#security" className="transition-colors hover:text-foreground">
              Security
            </a>
            <a href="#start" className="transition-colors hover:text-foreground">
              Get started
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">
                Get started
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <Sparkles className="size-3.5" />
            University prototype · Interactive demo
          </Badge>
          <h1 className="font-heading mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            One vault for your digital wealth — and the people who inherit it
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Organize digital assets, estimated values in ₹, recovery
            instructions, insurance notes, and nominee authorizations — with a
            controlled inheritance flow that never confuses silence with
            certainty.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="#start">
                Get started
                <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#features">Explore features</a>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            All demo valuations are fictional estimates. Not financial advice.
          </p>
        </section>

        <section id="features" className="border-t bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Everything a digital estate needs
              </h2>
              <p className="mt-3 text-muted-foreground">
                An asset inventory and guidance platform — it organizes your
                wealth, it never sells or transfers anything itself.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title}>
                  <CardHeader>
                    <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="size-4.5" />
                    </span>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                How the vault works
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((item) => (
                <Card key={item.step}>
                  <CardHeader>
                    <span className="text-xs font-semibold tracking-widest text-primary">
                      {item.step}
                    </span>
                    <CardTitle>{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="border-t bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Security by design
              </h2>
              <p className="mt-3 text-muted-foreground">
                Built as a careful, honest prototype for a university
                demonstration.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {securityPoints.map((point) => (
                <Card key={point.title}>
                  <CardHeader>
                    <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <point.icon className="size-4.5" />
                    </span>
                    <CardTitle>{point.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{point.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="start" className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Card className="mx-auto max-w-3xl text-center">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">
                  Try the live demo
                </CardTitle>
                <CardDescription>
                  The full prototype runs locally in minutes — seeded demo
                  accounts, dashboard, and email-verified authentication are
                  all included. Full instructions live in the README.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <pre className="w-full overflow-x-auto rounded-lg bg-muted px-4 py-3 text-left text-xs leading-relaxed sm:text-sm">
                  <code>{`npm install
npm run db:migrate && npm run db:seed
npm run dev    # http://localhost:3000`}</code>
                </pre>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild size="lg">
                    <Link href="/register">
                      Create your account
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg">
                    <Link href="/dashboard">Open dashboard</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Demo accounts: <strong>ada@demo.local</strong> (owner),{" "}
                  <strong>maya@demo.local</strong> (nominee) — password{" "}
                  <strong>DemoPass123!</strong>. All demo data is fictional and
                  safe to reset.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>Digital Wealth Vault · Academic prototype</p>
          <Separator className="hidden sm:block sm:w-16" />
          <p>Fictional demo data · Not financial advice</p>
        </div>
      </footer>
    </div>
  );
}
