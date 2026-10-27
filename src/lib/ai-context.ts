/**
 * Allowlisted AI context builder.
 *
 * This is the *only* bridge between the database and the AI provider. It is
 * deliberately hand-written field by field: Prisma rows are never serialized
 * wholesale, and the denylist below is enforced by construction — if a field
 * is not explicitly listed in `assetContext()`, it never leaves the server.
 *
 * Never added here (non-exhaustive denylist for reviewers):
 *   password / password hashes, session or auth tokens, cookies,
 *   private keys / seed phrases / recovery codes, inheritance claim codes or
 *   their hashes, third-party credentials, OAuth access/refresh tokens,
 *   API keys or secrets, `accountReference` (full account identifiers),
 *   `description`, `recoveryInstructions`, `ownershipEvidence` (free text that
 *   may contain credentials), nominee names/emails/relationships, user email.
 *
 * Asset titles and provider names are included because the chatbot must be
 * able to talk about specific assets. They are user-entered data, so the
 * system prompt treats everything inside the context as untrusted data.
 */

import type { PortfolioSnapshot } from "@/lib/portfolio";

/** Hard bound on how many assets are ever handed to the model. */
export const MAX_CONTEXT_ASSETS = 100;

/** Hard bound on the serialized context size sent to the provider. */
export const MAX_CONTEXT_CHARS = 40_000;

export type AssetContextRef = {
  ref: string;
  id: string;
  title: string;
  category: string;
};

export type PortfolioContext = {
  /** Pretty-printed JSON string, size-bounded, safe to send to the provider. */
  json: string;
  /** ref -> real asset identity, so AI output can be scoped server-side. */
  refs: Map<string, AssetContextRef>;
  assetCount: number;
  truncated: boolean;
};

function assetContext(snapshot: PortfolioSnapshot) {
  return snapshot.assets
    .filter((asset) => asset.status === "ACTIVE")
    .slice(0, MAX_CONTEXT_ASSETS)
    .map((asset, index) => ({
      ref: `A${index + 1}`,
      id: asset.id,
      title: asset.title,
      category: asset.category,
      provider: asset.providerName,
      currency: asset.currency,
      savedValue: asset.savedValue,
      valuationDate: asset.valuationDate,
      valuationAgeDays: asset.valuationAgeDays,
      freshness: asset.freshness,
      valuationSource: asset.valuationSource,
      historyCount: asset.historyCount,
      isDemo: asset.isDemo,
      hasDescription: asset.flags.hasDescription,
      hasAccountReference: asset.flags.hasAccountReference,
      hasRecoveryInstructions: asset.flags.hasRecoveryInstructions,
      hasOwnershipEvidence: asset.flags.hasOwnershipEvidence,
      hasValuationBasis: asset.flags.hasValuationBasis,
      officialLinkCount: asset.flags.officialLinkCount,
      sellingStepCount: asset.flags.sellingStepCount,
      resaleEligible: asset.flags.resaleEligible,
    }));
}

/**
 * Builds the sanitized context document plus the ref map used to resolve
 * whatever scope the model returns back to real records owned by this user.
 */
export function buildPortfolioContext(snapshot: PortfolioSnapshot): PortfolioContext {
  let rows = assetContext(snapshot);
  const activeCount = snapshot.assetCount;

  // Bound the serialized size: shrink the asset list until it fits. Assets
  // are dropped from the end, and the caller is told via `truncated`.
  const base = makeDocument(snapshot, rows, activeCount > rows.length);
  let json = JSON.stringify(base, null, 2);
  while (json.length > MAX_CONTEXT_CHARS && rows.length > 1) {
    rows = rows.slice(0, Math.max(1, Math.floor(rows.length * 0.7)));
    json = JSON.stringify(makeDocument(snapshot, rows, true), null, 2);
  }

  const refs = new Map<string, AssetContextRef>();
  for (const row of rows) {
    refs.set(row.ref, { ref: row.ref, id: row.id, title: row.title, category: row.category });
  }

  return {
    json,
    refs,
    assetCount: activeCount,
    truncated: activeCount > rows.length,
  };
}

function makeDocument(
  snapshot: PortfolioSnapshot,
  rows: ReturnType<typeof assetContext>,
  truncated: boolean,
) {
  return {
    generatedAt: snapshot.generatedAt,
    dataNotice:
      "All values below are saved valuations recorded in Digital Wealth Vault, " +
      "not live market prices. No market-data provider is connected. Totals are " +
      "per currency and must never be added together across currencies. No " +
      "exchange rates or conversions are available.",
    assetCount: snapshot.assetCount,
    archivedCount: snapshot.archivedCount,
    totalsByCurrency: snapshot.totalsByCurrency,
    categories: snapshot.categories,
    // Empty array means: no historical valuation records exist. Do not infer a trend.
    historicalChanges: snapshot.history,
    completeness: {
      staleValuations: snapshot.health.staleCount,
      missingValuationDates: snapshot.health.missingDateCount,
      missingRecoveryInstructions: snapshot.health.missingRecoveryCount,
      missingOwnershipEvidence: snapshot.health.missingOwnershipEvidenceCount,
      missingAccountReference: snapshot.health.missingAccountReferenceCount,
      assetsWithValuationHistory: snapshot.health.assetsWithHistory,
      staleAfterDays: 90,
    },
    inheritancePlanning: {
      nomineeCount: snapshot.nominees.total,
      activeNominees: snapshot.nominees.active,
      inheritanceRequestCount: snapshot.inheritance.total,
      inheritanceStatusCounts: snapshot.inheritance.byStatus,
    },
    assets: rows,
    truncationNotice: truncated
      ? `Only the first ${rows.length} of ${snapshot.assetCount} active assets are included.`
      : null,
  };
}

/** Compact one-paragraph summary used in prompts that do not need the full JSON. */
export function buildPortfolioSummary(snapshot: PortfolioSnapshot): string {
  const totals = snapshot.totalsByCurrency
    .map((entry) => `${entry.total.toFixed(2)} ${entry.currency}`)
    .join(", ");
  return [
    `${snapshot.assetCount} active asset(s)${snapshot.archivedCount ? `, ${snapshot.archivedCount} archived` : ""}.`,
    totals ? `Saved value by currency: ${totals}.` : "No saved valuations yet.",
    `Categories: ${snapshot.categories
      .map((entry) => `${entry.category} (${entry.count})`)
      .join(", ") || "none"}.`,
  ].join(" ");
}
