import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { toAmount } from "@/lib/currency";
import type { CreateAssetInput, UpdateAssetInput } from "@/lib/asset-schemas";

type CategoryBucket = {
  count: number;
  totals: Map<string, number>;
};

export async function getDashboardAssets(userId: string) {
  const assets = await prisma.asset.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  });

  const byCurrency = new Map<string, number>();
  const byCategory = new Map<string, CategoryBucket>();

  for (const asset of assets) {
    if (asset.status !== "ACTIVE") continue;

    const amount = toAmount(asset.estimatedValue);
    const currency = (asset.currency || "INR").toUpperCase();

    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);

    const key = asset.category;
    const bucket = byCategory.get(key) ?? { count: 0, totals: new Map() };
    bucket.count += 1;
    bucket.totals.set(currency, (bucket.totals.get(currency) ?? 0) + amount);
    byCategory.set(key, bucket);
  }

  return {
    assets: assets.map((asset) => ({
      ...asset,
      estimatedValue: toAmount(asset.estimatedValue),
    })),
    totals: {
      byCurrency: Array.from(byCurrency.entries()).map(([currency, total]) => ({
        currency,
        total,
      })),
      byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        totals: Array.from(data.totals.entries()).map(
          ([currency, total]) => ({ currency, total }),
        ),
      })),
      assetCount: assets.filter((asset) => asset.status === "ACTIVE").length,
    },
  };
}

function normalizedText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function listAssets(userId: string) {
  const assets = await prisma.asset.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      category: true,
      providerName: true,
      status: true,
      currency: true,
      isDemo: true,
      estimatedValue: true,
      createdAt: true,
    },
  });
  return assets.map((asset) => ({
    ...asset,
    estimatedValue: toAmount(asset.estimatedValue),
  }));
}

export async function getAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, ownerId: userId },
    include: {
      officialLinks: { orderBy: { id: "asc" } },
      valuations: { orderBy: { valuedAt: "desc" }, take: 12 },
      _count: {
        select: {
          inheritanceRequests: true,
          authorizations: true,
          sellingSteps: true,
          valuations: true,
        },
      },
    },
  });
  if (!asset) return null;

  return {
    ...asset,
    estimatedValue: toAmount(asset.estimatedValue),
    valuations: asset.valuations.map((valuation) => ({
      ...valuation,
      value: toAmount(valuation.value),
    })),
    counts: asset._count,
    protectedFromDelete:
      asset._count.inheritanceRequests > 0 || asset._count.authorizations > 0,
  };
}

export async function createAsset(userId: string, input: CreateAssetInput) {
  const id = randomUUID();
  const officialUrl = normalizedText(input.officialUrl);

  await prisma.asset.create({
    data: {
      id,
      ownerId: userId,
      title: input.title,
      category: input.category,
      providerName: input.providerName,
      estimatedValue: input.estimatedValue,
      currency: input.currency,
      description: normalizedText(input.description),
      accountReference: normalizedText(input.accountReference),
      valuationBasis: normalizedText(input.valuationBasis),
      valuationDate: new Date(),
      isDemo: false,
      status: "ACTIVE",
      officialLinks: officialUrl
        ? {
            create: [
              {
                id: randomUUID(),
                label: "Provider website",
                url: officialUrl,
                type: "OFFICIAL_SITE",
              },
            ],
          }
        : undefined,
    },
  });

  return id;
}

type UpdateAssetData = {
  title?: string;
  category?: CreateAssetInput["category"];
  providerName?: string;
  estimatedValue?: number;
  currency?: CreateAssetInput["currency"];
  description?: string | null;
  accountReference?: string | null;
  valuationBasis?: string | null;
  status?: "ACTIVE" | "ARCHIVED";
  nomineeCanSeeAccountReference?: boolean;
};

export type UpdateAssetResult = "updated" | "not_found";

export async function updateAsset(
  userId: string,
  assetId: string,
  input: UpdateAssetInput,
): Promise<UpdateAssetResult> {
  const data: UpdateAssetData = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.category !== undefined) data.category = input.category;
  if (input.providerName !== undefined) data.providerName = input.providerName;
  if (input.estimatedValue !== undefined)
    data.estimatedValue = input.estimatedValue;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.description !== undefined)
    data.description = input.description.trim() === "" ? null : input.description;
  if (input.accountReference !== undefined)
    data.accountReference =
      input.accountReference.trim() === "" ? null : input.accountReference;
  if (input.valuationBasis !== undefined)
    data.valuationBasis =
      input.valuationBasis.trim() === "" ? null : input.valuationBasis;
  if (input.status !== undefined) data.status = input.status;
  if (input.nomineeCanSeeAccountReference !== undefined)
    data.nomineeCanSeeAccountReference = input.nomineeCanSeeAccountReference;

  const urlProvided = input.officialUrl !== undefined;
  const newUrl = normalizedText(input.officialUrl);

  const { count } = await prisma.asset.updateMany({
    where: { id: assetId, ownerId: userId },
    data,
  });
  if (count === 0) return "not_found";

  if (urlProvided) {
    const existing = await prisma.officialLink.findFirst({
      where: { assetId, type: "OFFICIAL_SITE" },
      orderBy: { id: "asc" },
    });
    if (newUrl) {
      if (existing) {
        await prisma.officialLink.update({
          where: { id: existing.id },
          data: { url: newUrl },
        });
      } else {
        await prisma.officialLink.create({
          data: {
            id: randomUUID(),
            assetId,
            label: "Provider website",
            url: newUrl,
            type: "OFFICIAL_SITE",
          },
        });
      }
    } else if (existing) {
      await prisma.officialLink.delete({ where: { id: existing.id } });
    }
  }

  return "updated";
}

export type DeleteAssetResult = "deleted" | "not_found" | "protected";

export async function deleteAsset(
  userId: string,
  assetId: string,
): Promise<DeleteAssetResult> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, ownerId: userId },
    select: {
      id: true,
      _count: { select: { inheritanceRequests: true, authorizations: true } },
    },
  });
  if (!asset) return "not_found";

  if (
    asset._count.inheritanceRequests > 0 ||
    asset._count.authorizations > 0
  ) {
    return "protected";
  }

  const { count } = await prisma.asset.deleteMany({
    where: { id: assetId, ownerId: userId },
  });
  return count === 1 ? "deleted" : "not_found";
}
