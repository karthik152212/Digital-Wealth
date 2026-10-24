import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  Bell,
  Boxes,
  IndianRupee,
  Inbox,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";

import { getDashboardAssets } from "@/lib/assets";
import { categoryLabel } from "@/lib/asset-schemas";
import { formatMoney } from "@/lib/currency";
import { listMyNotifications, isNomineeSomewhere } from "@/lib/notifications";
import { getSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CheckInButton } from "@/components/dashboard/check-in-button";
import { AssetTableSkeleton } from "@/components/dashboard/asset-table-skeleton";

export const instant = false;

export const metadata: Metadata = {
  title: "Dashboard | Digital Wealth Vault",
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

  const { assets, totals } = await getDashboardAssets(session.user.id);
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Your vault
          </h1>
          <p className="mt-1 text-muted-foreground">
            Signed in as {session.user.email}
            {(session.user as { isDemo?: boolean }).isDemo && (
              <Badge variant="secondary" className="ml-2 align-middle">
                Demo account
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/nominees">
              <Users className="size-4" />
              Nominees
            </Link>
          </Button>
          {isNominee && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/nominee">
                <Inbox className="size-4" />
                Nominee portal
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/dashboard/assets/new">
              <Plus className="size-4" />
              Add asset
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total assets</CardTitle>
            <Boxes className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totals.assetCount}</div>
            <p className="text-xs text-muted-foreground">
              Owned by you in this vault
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimated value
            </CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {totals.byCurrency.length === 0 ? (
              <div className="text-3xl font-semibold">—</div>
            ) : (
              <div className="space-y-1">
                {totals.byCurrency.map((item) => (
                  <div key={item.currency} className="text-xl font-semibold">
                    {formatMoney(item.total, item.currency)}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Active assets · fictional estimates, not financial advice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-in</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4.5" />
            Notifications
          </CardTitle>
          <CardDescription>
            In-app notices for invitations, releases and access changes. This
            prototype never sends emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notifications yet. Invitations, releases and access changes
              will appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {inNotifications.map((notification) => (
                <li key={notification.id} className="py-3 first:pt-0 last:pb-0">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4.5" />
            Category summary
          </CardTitle>
          <CardDescription>
            Estimated value grouped by asset category, shown separately per
            currency. Records marked &quot;Demo&quot; are fictional sample data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totals.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assets yet. Add your first digital asset to see a summary
              here.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {totals.byCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {categoryLabel(item.category)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} asset{item.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    {item.totals.map((total) => (
                      <div
                        key={total.currency}
                        className="text-sm font-semibold"
                      >
                        {formatMoney(total.total, total.currency)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your assets</CardTitle>
          <CardDescription>
            Only assets you own are shown. Each row respects its stored
            currency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Boxes className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">No assets yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Your vault is empty. Assets you add will appear here with their
                estimated values and recovery guidance.
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
                    <th className="pb-3 pr-4 font-medium">Title</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Provider</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 text-right font-medium">Est. value</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
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
                          <div className="text-xs text-muted-foreground">
                            {asset.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {categoryLabel(asset.category)}
                      </td>
                      <td className="py-3 pr-4">{asset.providerName}</td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={
                            asset.status === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {asset.status === "ACTIVE" ? "Active" : "Archived"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatMoney(asset.estimatedValue, asset.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
            Loading your vault…
          </div>
          <AssetTableSkeleton />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
