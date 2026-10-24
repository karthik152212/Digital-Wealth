import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { getAsset } from "@/lib/assets";
import { categoryLabel } from "@/lib/asset-schemas";
import { getSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssetForm, type AssetFormInitial } from "@/components/assets/asset-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Edit asset | Digital Wealth Vault",
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

export default async function EditAssetPage({
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

  const initial: AssetFormInitial = {
    title: asset.title,
    category: asset.category,
    providerName: asset.providerName,
    estimatedValue: String(asset.estimatedValue),
    currency: asset.currency,
    description: asset.description ?? "",
    accountReference: asset.accountReference ?? "",
    valuationBasis: asset.valuationBasis ?? "",
    officialUrl:
      asset.officialLinks.find((link) => link.type === "OFFICIAL_SITE")?.url ??
      "",
    status: asset.status,
    nomineeCanSeeAccountReference: asset.nomineeCanSeeAccountReference,
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={`/dashboard/assets/${asset.id}`}>
              <ArrowLeft className="size-4" />
              Back to asset
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {asset.title}
            </h1>
            {asset.isDemo && <Badge variant="outline">Demo</Badge>}
            <Badge variant={asset.status === "ACTIVE" ? "default" : "secondary"}>
              {asset.status === "ACTIVE" ? "Active" : "Archived"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {categoryLabel(asset.category)} · owned by you since{" "}
            {formatDate(asset.createdAt)}
          </p>
        </div>
      </div>

      <AssetForm mode="edit" assetId={asset.id} initial={initial} />
      </div>
    </div>
  );
}
