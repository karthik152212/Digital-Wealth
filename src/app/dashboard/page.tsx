import { Suspense, type ComponentType } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  Bell,
  Bitcoin,
  Boxes,
  Cloud,
  CreditCard,
  FileCheck2,
  Gamepad2,
  Globe,
  Image as ImageIcon,
  Inbox,
  Key,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  AtSign,
} from "lucide-react";

import { getPortfolioSnapshot, STALE_AFTER_DAYS } from "@/lib/portfolio";
import { categoryLabel } from "@/lib/asset-schemas";
import { formatMoney } from "@/lib/currency";
import { listMyNotifications, isNomineeSomewhere } from "@/lib/notifications";
import { getSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CheckInButton } from "@/components/dashboard/check-in-button";
import { AssetTableSkeleton } from "@/components/dashboard/asset-table-skeleton";
import { FirstTimeIntro } from "@/components/dashboard/first-time-intro";
import { AiInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import { PortfolioDistribution } from "@/components/dashboard/portfolio-distribution";

export const instant = false;

export const metadata: Metadata = {
  title: "Dashboard | Digital Wealth Vault",
};

const CATEGORY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  CRYPTO: Bitcoin,
  DOMAIN: Globe,
  CLOUD_STORAGE: Cloud,
  INVESTMENT: TrendingUp,
  GAMING: Gamepad2,
  DIGITAL_CONTENT: ImageIcon,
  SOCIAL_MEDIA: AtSign,
  PAYMENT_ACCOUNT: CreditCard,
  SOFTWARE_LICENSE: Key,
  OTHER: Package,
};

function daysSince(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const ms = Date.now() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function DashboardContent() {
  await connection();
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const snapshot = await getPortfolioSnapshot(session.user.id);
  const assets = snapshot.assets;
  const totals = {
    byCurrency: snapshot.totalsByCurrency,
    byCategory: snapshot.categories,
    assetCount: snapshot.assetCount,
  };
  const valuationStatus = {
    current:
      snapshot.assetCount - snapshot.health.staleCount - snapshot.health.missingDateCount,
    stale: snapshot.health.staleCount,
    undated: snapshot.health.missingDateCount,
  };
  const [inNotifications, isNominee] = await Promise.all([
    listMyNotifications(session.user.id),
    isNomineeSomewhere(session.user.email),
  ]);
  const inactivityDays = daysSince(
    (session.user as { lastSeenAt?: string | Date | null }).lastSeenAt,
  );
  const thresholdDays = Number(process.env.INACTIVITY_THRESHOLD_DAYS ?? 30);
  const needsCheckIn =
    inactivityDays == null || inactivityDays >= thresholdDays;
  const isDemo = (session.user as { isDemo?: boolean }).isDemo ?? false;

  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      {/* Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Digital Wealth Vault
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
            {firstName ? `Hello, ${firstName}` : "Your vault"}
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            Signed in as {session.user.email}
            {isDemo && (
              <Badge variant="secondary" className="ml-2 align-middle">
                Demo account
              </Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isNominee && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/nominee">
                <Inbox className="size-4" />
                Nominee portal
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/chat">
              <MessageSquare className="size-4" />
              Ask the AI vault
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/nominees">
              <Users className="size-4" />
              Nominees &amp; inheritance
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/assets/new">
              <Plus className="size-4" />
              Add asset
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <FirstTimeIntro />

      {/* Unified wealth overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wealth overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight">
                  {totals.assetCount}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {totals.assetCount === 1 ? "active asset" : "active assets"}{" "}
                  in your vault
                </p>
              </div>
              <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Estimated value
                </p>
                {totals.byCurrency.length === 0 ? (
                  <div className="mt-2 text-2xl font-semibold text-muted-foreground">
                    —
                  </div>
                ) : (
                  <dl className="mt-2 space-y-1.5">
                    {totals.byCurrency.map((item) => (
                      <div key={item.currency} className="flex items-baseline gap-3">
                        <dt className="text-sm text-muted-foreground">
                          {item.currency}
                        </dt>
                        <dd className="text-2xl font-semibold tracking-tight">
                          {formatMoney(item.total, item.currency)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {snapshot.assetCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Valuation status:
                  </span>
                  {valuationStatus.current > 0 && (
                    <Badge variant="outline">
                      {valuationStatus.current} current (within {STALE_AFTER_DAYS} days)
                    </Badge>
                  )}
                  {valuationStatus.stale > 0 && (
                    <Badge variant="secondary">
                      {valuationStatus.stale} stale ({STALE_AFTER_DAYS}+ days)
                    </Badge>
                  )}
                  {valuationStatus.undated > 0 && (
                    <Badge variant="secondary">
                      {valuationStatus.undated} without a date
                    </Badge>
                  )}
                </div>
              )}
              {snapshot.history.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Recorded valuation history
                  </p>
                  {snapshot.history.map((entry) => (
                    <p key={entry.currency} className="text-xs text-muted-foreground">
                      {entry.currency}: {formatMoney(entry.earliest.value, entry.currency)}{" "}
                      on {new Date(entry.earliest.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                      → {formatMoney(entry.latest.value, entry.currency)} on{" "}
                      {new Date(entry.latest.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                      ({entry.delta >= 0 ? "+" : ""}
                      {formatMoney(entry.delta, entry.currency)}) across{" "}
                      {entry.assetsWithHistory} of {entry.assetsTotal} assets
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No valuation history recorded yet — a change will appear here
                  once an asset has two or more recorded valuations.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Saved valuations, not live prices: no market-data provider is
                connected, so nothing here refreshes automatically. Currencies
                are never mixed into one total.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Keep it active</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              {inactivityDays == null ? (
                <span className="text-muted-foreground">Never checked in</span>
              ) : (
                <span>
                  Last activity {inactivityDays} day
                  {inactivityDays === 1 ? "" : "s"} ago
                </span>
              )}
            </div>
            {needsCheckIn && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                You&apos;re approaching the inactivity threshold. Check in to
                keep your vault active.
              </p>
            )}
            <CheckInButton />
          </CardContent>
        </Card>
      </div>

      <AiInsightsPanel />

      {/* Category breakdown */}
      <section aria-label="Category breakdown">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Where your wealth lives
            </h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-3.5" />
              Grouped by asset category, valued per currency
            </div>
          </div>
        </div>
        {totals.byCategory.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            No categories yet — add your first asset and its category will
            appear here.
          </p>
        ) : (
          <>
            <div className="mb-5 rounded-xl border bg-card p-4">
              <PortfolioDistribution
                categories={totals.byCategory}
                totalsByCurrency={totals.byCurrency}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {totals.byCategory.map((item) => {
              const Icon = CATEGORY_ICONS[item.category] ?? Package;
              return (
                <div
                  key={item.category}
                  className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {categoryLabel(item.category)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} asset{item.count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-0.5">
                    {item.totals.map((total) => (
                      <div
                        key={total.currency}
                        className="text-lg font-semibold tracking-tight"
                      >
                        {formatMoney(total.total, total.currency)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </section>

      {/* Assets */}
      <section aria-label="Your assets">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Your assets
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/assets/new">
              <Plus className="size-4" />
              Add asset
            </Link>
          </Button>
        </div>
        <div className="rounded-xl border bg-card">
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <Boxes className="mb-3 size-10 text-muted-foreground/50" />
              <p className="font-medium">No assets yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Your vault is empty. Assets you add will appear here with
                their estimated values and recovery guidance.
              </p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/assets/new">
                  <Plus className="size-4" />
                  Add your first asset
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 pb-3 pr-4 pt-4 font-medium">Title</th>
                    <th className="px-0 pb-3 pr-4 pt-4 font-medium">Category</th>
                    <th className="hidden pb-3 pr-4 pt-4 font-medium sm:table-cell">
                      Provider
                    </th>
                    <th className="pb-3 pr-4 pt-4 font-medium">Status</th>
                    <th className="hidden pb-3 pr-4 pt-4 font-medium md:table-cell">
                      Valuation
                    </th>
                    <th className="px-4 pb-3 pl-0 pr-4 pt-4 text-right font-medium">
                      Saved value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b last:border-0">
                      <td className="px-4 py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/assets/${asset.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {asset.title}
                          </Link>
                          {asset.isDemo && (
                            <Badge variant="outline" className="shrink-0">
                              Demo
                            </Badge>
                          )}
                        </div>
                        {asset.description && (
                          <div className="mt-0.5 hidden max-w-md truncate text-xs text-muted-foreground sm:block">
                            {asset.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {categoryLabel(asset.category)}
                      </td>
                      <td className="hidden py-3 pr-4 sm:table-cell">
                        {asset.providerName}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={
                            asset.status === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {asset.status === "ACTIVE" ? "Active" : "Archived"}
                        </Badge>
                      </td>
                      <td className="hidden py-3 pr-4 md:table-cell">
                        <div className="text-sm">
                          {asset.valuationDate ? (
                            new Date(asset.valuationDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          ) : (
                            <span className="text-muted-foreground">No date</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Manual entry
                          </Badge>
                          {asset.freshness === "STALE" && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              Stale
                            </Badge>
                          )}
                          {asset.freshness === "UNKNOWN_DATE" && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              No date
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatMoney(asset.savedValue, asset.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Notifications — quieter, secondary */}
      <section aria-label="Notifications">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Notifications
          </h2>
        </div>
        <div className="rounded-xl border bg-muted/40">
          {inNotifications.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No notifications yet. Invitations, releases and access changes
              will appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {inNotifications.map((notification) => (
                <li key={notification.id} className="px-5 py-3 first:pt-4 last:pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {notification.isDemo && (
                      <Badge variant="outline" className="shrink-0">
                        Demo
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <FileCheck2 className="mr-1 inline size-3 align-[-1px]" />
          In-app notices for invitations, releases and access changes. This
          prototype never sends emails. Need inheritance access?
          {" "}
          <Link
            href="/dashboard/nominees"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Manage nominees
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading your vault…</span>
          </div>
          <AssetTableSkeleton />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
