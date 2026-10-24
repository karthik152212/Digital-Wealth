import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";

import { getReleasedAssetForNominee } from "@/lib/inheritance";
import { categoryLabel } from "@/lib/asset-schemas";
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

export const instant = false;

export const metadata: Metadata = {
  title: "Recovery view | Digital Wealth Vault",
};

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ReleasedAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const released = await getReleasedAssetForNominee(session.user.email, id);
  if (!released) {
    notFound();
  }

  const asset = released.asset;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/nominee">
            <ArrowLeft className="size-4" />
            Back to nominee portal
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {asset.title}
          </h1>
          {asset.isDemo && <Badge variant="outline">Demo</Badge>}
          <Badge variant="default">Released</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {categoryLabel(asset.category)}
          {asset.providerName && ` · ${asset.providerName}`} · released{" "}
          {formatDate(released.releasedAt)} · attempt {released.attempt}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4.5" />
            What this is
          </CardTitle>
          <CardDescription>
            The owner approved your claim and released this guidance-only
            recovery view. This is simulated: no password, secret, fund or
            ownership transfer has occurred, and this view establishes no
            legal entitlement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {asset.accountReference && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Account identifier</p>
              <p className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {asset.accountReference}
              </p>
              <p className="text-xs text-muted-foreground">
                Shared by the owner for this release.
              </p>
            </div>
          )}

          {asset.recoveryInstructions ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Recovery instructions</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {asset.recoveryInstructions}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recovery instructions were recorded by the owner.
            </p>
          )}

          {asset.ownershipEvidence && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Ownership evidence</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {asset.ownershipEvidence}
              </p>
            </div>
          )}

          {asset.officialLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Official links</p>
              <ul className="space-y-1">
                {asset.officialLinks.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Authorization {released.authorizationId} · granted by the owner ·
        revocable by the owner at any time. Valuation and resale information
        is never shown here.
      </p>
    </div>
  );
}
