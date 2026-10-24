import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, History, Pencil } from "lucide-react";

import { getAsset } from "@/lib/assets";
import { categoryLabel } from "@/lib/asset-schemas";
import { formatMoney } from "@/lib/currency";
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
import { Separator } from "@/components/ui/separator";
import { DeleteAssetButton } from "@/components/assets/delete-asset-button";

export const instant = false;

export const metadata: Metadata = {
  title: "Asset details | Digital Wealth Vault",
};

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-44 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function AssetDetailPage({
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
  const asset = await getAsset(session.user.id, id);
  if (!asset) {
    notFound();
  }

  const officialLinks = asset.officialLinks.filter(
    (link) => link.type !== "OFFICIAL_SITE",
  );
  const officialSite = asset.officialLinks.find(
    (link) => link.type === "OFFICIAL_SITE",
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to vault
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {asset.title}
            </h1>
            <Badge variant={asset.status === "ACTIVE" ? "default" : "secondary"}>
              {asset.status === "ACTIVE" ? "Active" : "Archived"}
            </Badge>
            {asset.isDemo && <Badge variant="outline">Demo</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {categoryLabel(asset.category)} · {asset.providerName} · owned by
            you since {formatDate(asset.createdAt)}
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/assets/${asset.id}/edit`}>
            <Pencil className="size-4" />
            Edit asset
          </Link>
        </Button>
      </div>

      {asset.isDemo && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          This is fictional demo sample data created for the project showcase.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimated value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatMoney(asset.estimatedValue, asset.currency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {asset.currency} · fictional estimate, not financial advice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {formatDate(asset.valuationDate)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {asset.valuationBasis || "No valuation basis recorded"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {asset.resaleEligible ? "Eligible" : "Not eligible"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {asset.resaleNotes || "No resale notes recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asset details</CardTitle>
          <CardDescription>
            Everything recorded about this asset in your vault.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <DetailRow label="Asset name">{asset.title}</DetailRow>
            <DetailRow label="Category">
              {categoryLabel(asset.category)}
            </DetailRow>
            <DetailRow label="Provider">{asset.providerName}</DetailRow>
            <DetailRow label="Estimated value">
              {formatMoney(asset.estimatedValue, asset.currency)}
            </DetailRow>
            <DetailRow label="Account identifier">
              {asset.accountReference || (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </DetailRow>
            <DetailRow label="Description">
              {asset.description || (
                <span className="text-muted-foreground">No description</span>
              )}
            </DetailRow>
            <DetailRow label="Valuation basis">
              {asset.valuationBasis || (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </DetailRow>
            <DetailRow label="Official website">
              {officialSite ? (
                <a
                  href={officialSite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  {officialSite.url}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </DetailRow>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recovery guidance</CardTitle>
            <CardDescription>
              Instructions for your nominee if this asset becomes inaccessible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Recovery instructions</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {asset.recoveryInstructions || "None recorded."}
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="text-sm font-medium">Ownership evidence</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {asset.ownershipEvidence || "None recorded."}
              </p>
            </div>
            {officialLinks.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium">Useful links</h3>
                  <ul className="mt-2 space-y-1">
                    {officialLinks.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                        >
                          {link.label}
                          <ExternalLink
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4.5" />
              Valuation history
            </CardTitle>
            <CardDescription>
              Recent estimated values recorded for this asset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {asset.valuations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No valuation history yet. Current estimate:{" "}
                {formatMoney(asset.estimatedValue, asset.currency)}.
              </p>
            ) : (
              <ul className="space-y-3">
                {asset.valuations.map((valuation) => (
                  <li
                    key={valuation.id}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {formatMoney(valuation.value, valuation.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(valuation.valuedAt)}
                        {valuation.basis ? ` · ${valuation.basis}` : ""}
                      </div>
                    </div>
                    {valuation.isDemo && (
                      <Badge variant="outline" className="shrink-0">
                        Demo
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Remove from vault</CardTitle>
          <CardDescription>
            Deleting removes the record and its valuation history, recovery
            steps and official links. Assets linked to inheritance records can
            only be archived, never deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAssetButton
            assetId={asset.id}
            assetTitle={asset.title}
            status={asset.status}
            counts={asset.counts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
