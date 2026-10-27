import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { toAmount } from "@/lib/currency";

/**
 * Deterministic portfolio calculations.
 *
 * Everything in this module is computed from validated database values with
 * plain application code. No AI model ever participates in producing these
 * numbers: the dashboard renders them directly, and the AI layer receives a
 * sanitized copy so the chatbot and the insights panel can never contradict
 * what is on screen.
 *
 * Currency rules (non-negotiable):
 *  - Totals are kept per currency. Currencies are never summed together.
 *  - No implicit FX conversion happens anywhere here. There is no exchange
 *    rate source wired into this application, so the app only ever shows the
 *    user's *saved* valuation per currency.
 */

/** A valuation older than this is flagged as stale in the UI and insights. */
export const STALE_AFTER_DAYS = 90;

/**
 * The application has no market-data integration, so every stored valuation
 * is user-entered. Exposed so the UI can say so explicitly instead of
 * implying a live price.
 */
export const VALUATION_SOURCE = "MANUAL";
export const VALUATION_SOURCE_LABEL = "Manually entered";

export type ValuationFreshness = "CURRENT" | "STALE" | "UNKNOWN_DATE";

export type CurrencyTotal = { currency: string; total: number };

/** Per-asset completeness flags — booleans only, never free-text secrets. */
export type AssetFlags = {
  hasDescription: boolean;
  hasAccountReference: boolean;
  hasRecoveryInstructions: boolean;
  hasOwnershipEvidence: boolean;
  hasValuationBasis: boolean;
  officialLinkCount: number;
  sellingStepCount: number;
  resaleEligible: boolean;
};

export type PortfolioAsset = {
  id: string;
  title: string;
  category: string;
  providerName: string;
  status: "ACTIVE" | "ARCHIVED";
  currency: string;
  savedValue: number;
  /**
   * Display-only description text for the dashboard table. Deliberately NOT
   * part of the AI context allowlist — never send this to a provider.
   */
  description: string | null;
  /** ISO string, null when the record has no usable valuation date. */
  valuationDate: string | null;
  valuationAgeDays: number | null;
  freshness: ValuationFreshness;
  valuationSource: typeof VALUATION_SOURCE;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  flags: AssetFlags;
  /** Number of recorded valuation rows (history) for this asset. */
  historyCount: number;
};

export type CategoryGroup = {
  category: string;
  count: number;
  totals: CurrencyTotal[];
};

/**
 * A real historical change, computed only from stored `Valuation` rows.
 * Absent entirely (empty array) when no asset has two or more recorded
 * valuations — the UI must not render a change in that case.
 */
export type ValuationHistoryChange = {
  currency: string;
  assetsWithHistory: number;
  assetsTotal: number;
  earliest: { date: string; value: number };
  latest: { date: string; value: number };
  delta: number;
};

export type PortfolioHealth = {
  staleCount: number;
  missingDateCount: number;
  missingRecoveryCount: number;
  missingOwnershipEvidenceCount: number;
  missingAccountReferenceCount: number;
  assetsWithHistory: number;
  activeCount: number;
};

export type PortfolioSnapshot = {
  /** When this snapshot was computed (ISO). */
  generatedAt: string;
  /** Stable hash of the inputs; used to invalidate cached AI insights. */
  fingerprint: string;
  /** Active assets only. */
  assetCount: number;
  archivedCount: number;
  totalsByCurrency: CurrencyTotal[];
  categories: CategoryGroup[];
  /** All owned assets (active + archived), newest first. */
  assets: PortfolioAsset[];
  /** Empty when no real historical valuation records exist. */
  history: ValuationHistoryChange[];
  health: PortfolioHealth;
  nominees: { total: number; active: number };
  inheritance: { total: number; byStatus: Record<string, number> };
  /** Always false: there is no live market-data provider wired in. */
  hasLiveData: false;
};

// ---------------------------------------------------------------------------
// Pure builders (unit-testable without a database)
// ---------------------------------------------------------------------------

/** Loose row shape accepted by the builders (Prisma rows satisfy it). */
export type AssetRow = {
  id: string;
  title: string;
  category: string;
  providerName: string;
  status: string;
  currency: string | null;
  estimatedValue: unknown;
  valuationDate: Date | string | null;
  isDemo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  description?: string | null;
  accountReference?: string | null;
  ownershipEvidence?: string | null;
  recoveryInstructions?: string | null;
  valuationBasis?: string | null;
  resaleEligible?: boolean;
  _count?: { officialLinks: number; sellingSteps: number };
};

export type ValuationRow = {
  assetId: string;
  value: unknown;
  currency: string | null;
  valuedAt: Date | string;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function freshnessFor(
  valuationDate: Date | string | null | undefined,
  now: Date,
): { freshness: ValuationFreshness; ageDays: number | null; iso: string | null } {
  const date = toDate(valuationDate);
  if (!date) return { freshness: "UNKNOWN_DATE", ageDays: null, iso: null };
  const ageDays = daysBetween(date, now);
  return {
    freshness: ageDays > STALE_AFTER_DAYS ? "STALE" : "CURRENT",
    ageDays,
    iso: date.toISOString(),
  };
}

export function buildAsset(
  row: AssetRow,
  historyCount: number,
  now: Date,
): PortfolioAsset {
  const { freshness, ageDays, iso } = freshnessFor(row.valuationDate, now);
  const status = row.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    providerName: row.providerName,
    status,
    currency: (row.currency || "INR").toUpperCase(),
    savedValue: toAmount(row.estimatedValue),
    description: row.description && row.description.trim() ? row.description : null,
    valuationDate: iso,
    valuationAgeDays: ageDays,
    freshness,
    valuationSource: VALUATION_SOURCE,
    isDemo: Boolean(row.isDemo),
    createdAt: (toDate(row.createdAt) ?? now).toISOString(),
    updatedAt: (toDate(row.updatedAt) ?? now).toISOString(),
    flags: {
      hasDescription: Boolean(row.description && row.description.trim()),
      hasAccountReference: Boolean(row.accountReference && row.accountReference.trim()),
      hasRecoveryInstructions: Boolean(
        row.recoveryInstructions && row.recoveryInstructions.trim(),
      ),
      hasOwnershipEvidence: Boolean(
        row.ownershipEvidence && row.ownershipEvidence.trim(),
      ),
      hasValuationBasis: Boolean(row.valuationBasis && row.valuationBasis.trim()),
      officialLinkCount: row._count?.officialLinks ?? 0,
      sellingStepCount: row._count?.sellingSteps ?? 0,
      resaleEligible: Boolean(row.resaleEligible),
    },
    historyCount,
  };
}

function sumByCurrency(
  assets: PortfolioAsset[],
  pick: (asset: PortfolioAsset) => number = (asset) => asset.savedValue,
): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const asset of assets) {
    if (asset.status !== "ACTIVE") continue;
    totals.set(asset.currency, (totals.get(asset.currency) ?? 0) + pick(asset));
  }
  return Array.from(totals.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

function buildCategories(assets: PortfolioAsset[]): CategoryGroup[] {
  const buckets = new Map<string, { count: number; totals: Map<string, number> }>();

  for (const asset of assets) {
    if (asset.status !== "ACTIVE") continue;
    const bucket = buckets.get(asset.category) ?? { count: 0, totals: new Map() };
    bucket.count += 1;
    bucket.totals.set(
      asset.currency,
      (bucket.totals.get(asset.currency) ?? 0) + asset.savedValue,
    );
    buckets.set(asset.category, bucket);
  }

  return Array.from(buckets.entries())
    .map(([category, bucket]) => ({
      category,
      count: bucket.count,
      totals: Array.from(bucket.totals.entries())
        .map(([currency, total]) => ({ currency, total }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/**
 * Historical change per currency, computed from stored valuation rows.
 *
 * Only assets with at least two recorded valuations contribute, and the
 * result reports `assetsWithHistory`/`assetsTotal` so the UI can be explicit
 * that the comparison covers part of the portfolio. Returns an empty array
 * when no asset has real history — callers must not render a trend then.
 */
export function buildHistory(
  assets: PortfolioAsset[],
  valuations: ValuationRow[],
): ValuationHistoryChange[] {
  const byAsset = new Map<string, { value: number; date: Date }[]>();
  for (const row of valuations) {
    const date = toDate(row.valuedAt);
    if (!date) continue;
    const list = byAsset.get(row.assetId) ?? [];
    list.push({ value: toAmount(row.value), date });
    byAsset.set(row.assetId, list);
  }

  const activeById = new Map(
    assets.filter((asset) => asset.status === "ACTIVE").map((a) => [a.id, a]),
  );

  const perCurrency = new Map<
    string,
    {
      withHistory: number;
      earliest: { date: Date; value: number };
      latest: { date: Date; value: number };
    }
  >();

  for (const [assetId, rows] of byAsset) {
    const asset = activeById.get(assetId);
    if (!asset) continue;
    const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sorted.length < 2) continue;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const bucket = perCurrency.get(asset.currency);
    if (!bucket) {
      perCurrency.set(asset.currency, {
        withHistory: 1,
        earliest: { date: first.date, value: first.value },
        latest: { date: last.date, value: last.value },
      });
      continue;
    }
    bucket.withHistory += 1;
    if (first.date < bucket.earliest.date) {
      bucket.earliest = { date: first.date, value: first.value };
    }
    if (last.date > bucket.latest.date) {
      bucket.latest = { date: last.date, value: last.value };
    }
  }

  const activeCount = assets.filter((asset) => asset.status === "ACTIVE").length;

  return Array.from(perCurrency.entries())
    .map(([currency, bucket]) => ({
      currency,
      assetsWithHistory: bucket.withHistory,
      assetsTotal: activeCount,
      earliest: {
        date: bucket.earliest.date.toISOString(),
        value: bucket.earliest.value,
      },
      latest: { date: bucket.latest.date.toISOString(), value: bucket.latest.value },
      delta: bucket.latest.value - bucket.earliest.value,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function computeFingerprint(
  assets: PortfolioAsset[],
  extra: unknown[] = [],
): string {
  const hash = createHash("sha256");
  const rows = [...assets]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((asset) =>
      [
        asset.id,
        asset.status,
        asset.category,
        asset.currency,
        asset.savedValue.toFixed(2),
        asset.valuationDate ?? "",
        asset.updatedAt,
        asset.historyCount,
        Object.values(asset.flags).join(","),
      ].join("|"),
    );
  hash.update(JSON.stringify({ rows, extra }));
  return hash.digest("hex");
}

export type BuildSnapshotInput = {
  assets: AssetRow[];
  valuations?: ValuationRow[];
  nomineeStatuses?: string[];
  inheritanceStatuses?: string[];
  now?: Date;
};

export function buildPortfolioSnapshot(
  input: BuildSnapshotInput,
): PortfolioSnapshot {
  const now = input.now ?? new Date();
  const valuations = input.valuations ?? [];

  const historyCounts = new Map<string, number>();
  for (const row of valuations) {
    historyCounts.set(row.assetId, (historyCounts.get(row.assetId) ?? 0) + 1);
  }

  const assets = input.assets.map((row) =>
    buildAsset(row, historyCounts.get(row.id) ?? 0, now),
  );
  const active = assets.filter((asset) => asset.status === "ACTIVE");

  const nomineeStatuses = input.nomineeStatuses ?? [];
  const inheritanceStatuses = input.inheritanceStatuses ?? [];

  const byStatus: Record<string, number> = {};
  for (const status of inheritanceStatuses) {
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  const history = buildHistory(assets, valuations);

  return {
    generatedAt: now.toISOString(),
    fingerprint: computeFingerprint(assets, [
      history.length,
      nomineeStatuses.length,
      inheritanceStatuses.length,
    ]),
    assetCount: active.length,
    archivedCount: assets.length - active.length,
    totalsByCurrency: sumByCurrency(assets),
    categories: buildCategories(assets),
    assets,
    history,
    health: {
      staleCount: active.filter((asset) => asset.freshness === "STALE").length,
      missingDateCount: active.filter(
        (asset) => asset.freshness === "UNKNOWN_DATE",
      ).length,
      missingRecoveryCount: active.filter(
        (asset) => !asset.flags.hasRecoveryInstructions,
      ).length,
      missingOwnershipEvidenceCount: active.filter(
        (asset) => !asset.flags.hasOwnershipEvidence,
      ).length,
      missingAccountReferenceCount: active.filter(
        (asset) => !asset.flags.hasAccountReference,
      ).length,
      assetsWithHistory: active.filter((asset) => asset.historyCount >= 2).length,
      activeCount: active.length,
    },
    nominees: {
      total: nomineeStatuses.length,
      active: nomineeStatuses.filter((status) => status === "ACTIVE").length,
    },
    inheritance: { total: inheritanceStatuses.length, byStatus },
    hasLiveData: false,
  };
}

// ---------------------------------------------------------------------------
// Database access (always scoped to the authenticated owner)
// ---------------------------------------------------------------------------

/**
 * Loads every record belonging to `userId` and returns the computed snapshot.
 * Ownership is enforced by the query itself: records of other users are never
 * read, so they can never reach the dashboard or the AI context.
 */
export async function getPortfolioSnapshot(
  userId: string,
): Promise<PortfolioSnapshot> {
  const [assets, valuations, nominees, requests] = await Promise.all([
    prisma.asset.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { officialLinks: true, sellingSteps: true } } },
    }),
    prisma.valuation.findMany({
      where: { asset: { ownerId: userId } },
      orderBy: { valuedAt: "asc" },
      select: { assetId: true, value: true, currency: true, valuedAt: true },
    }),
    prisma.nominee.findMany({
      where: { ownerId: userId },
      select: { status: true },
    }),
    prisma.inheritanceRequest.findMany({
      where: { asset: { ownerId: userId } },
      select: { status: true },
    }),
  ]);

  return buildPortfolioSnapshot({
    assets,
    valuations,
    nomineeStatuses: nominees.map((nominee) => nominee.status),
    inheritanceStatuses: requests.map((request) => request.status),
  });
}
