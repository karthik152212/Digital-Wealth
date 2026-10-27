/**
 * AI context sanitizer tests.
 *
 * The context builder is the only bridge between the database and the model,
 * so these tests assert the denylist by construction: credential-like and
 * personally identifying fields must never appear in the serialized context,
 * allowlisted metadata must, and the payload must stay size-bounded.
 */
import "dotenv/config";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildPortfolioContext,
  MAX_CONTEXT_ASSETS,
  MAX_CONTEXT_CHARS,
} from "@/lib/ai-context";
import { buildPortfolioSnapshot, type AssetRow } from "@/lib/portfolio";

const NOW = new Date("2026-10-27T12:00:00.000Z");

function asset(overrides: Partial<AssetRow> & { id: string }): AssetRow {
  return {
    title: `Asset ${overrides.id}`,
    category: "OTHER",
    providerName: "Provider",
    status: "ACTIVE",
    currency: "INR",
    estimatedValue: 100,
    valuationDate: NOW,
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("ai context allowlist", () => {
  const snapshot = buildPortfolioSnapshot({
    now: NOW,
    assets: [
      asset({
        id: "a1",
        title: "Cold wallet",
        providerName: "Coinbase",
        category: "CRYPTO",
        estimatedValue: 50_000,
        description: "SECRET-DESCRIPTION-MARKER",
        accountReference: "acct-99887766",
        ownershipEvidence: "SECRET-OWNERSHIP-MARKER",
        recoveryInstructions: "SECRET-RECOVERY-MARKER",
        valuationBasis: "SECRET-BASIS-MARKER",
      }),
    ],
  });

  test("excludes credential-like and personal free-text fields", () => {
    const { json } = buildPortfolioContext(snapshot);

    for (const marker of [
      "SECRET-DESCRIPTION-MARKER",
      "acct-99887766",
      "SECRET-OWNERSHIP-MARKER",
      "SECRET-RECOVERY-MARKER",
      "SECRET-BASIS-MARKER",
    ]) {
      assert.ok(
        !json.includes(marker),
        `context leaked a sensitive value: ${marker}`,
      );
    }

    // Field names must not appear as keys either — only boolean flags.
    assert.ok(!/"description"\s*:/.test(json));
    assert.ok(!/"accountReference"\s*:/.test(json));
    assert.ok(!/"ownershipEvidence"\s*:/.test(json));
    assert.ok(!/"recoveryInstructions"\s*:/.test(json));
    assert.ok(!/"valuationBasis"\s*:/.test(json));
    assert.ok(!/"email"\s*:/i.test(json));
    assert.ok(!/"password"/i.test(json));
    assert.ok(!/"claimCode"/i.test(json));
    assert.ok(!/"token"/i.test(json));
    assert.ok(!/"seedPhrase"/i.test(json));
  });

  test("includes allowlisted metadata the assistant needs", () => {
    const { json, refs } = buildPortfolioContext(snapshot);

    assert.ok(json.includes('"title": "Cold wallet"'));
    assert.ok(json.includes('"provider": "Coinbase"'));
    assert.ok(json.includes('"category": "CRYPTO"'));
    assert.ok(json.includes('"savedValue": 50000'));
    assert.ok(/"hasRecoveryInstructions": (true|false)/.test(json));
    assert.ok(json.includes('"freshness"'));
    assert.ok(json.includes("not live market prices"));
    assert.equal(refs.get("A1")?.id, "a1");
    assert.equal(refs.get("A1")?.title, "Cold wallet");
  });
});

describe("ai context bounds", () => {
  test("caps the number of assets handed to the model", () => {
    const assets = Array.from({ length: 150 }, (_, index) =>
      asset({
        id: `a${index}`,
        title: `A very long asset title used to inflate the context size ${index} ${"x".repeat(80)}`,
      }),
    );
    const snapshot = buildPortfolioSnapshot({ now: NOW, assets });
    const { json, refs, truncated } = buildPortfolioContext(snapshot);

    assert.equal(snapshot.assetCount, 150);
    assert.ok(truncated);
    assert.ok(refs.size <= MAX_CONTEXT_ASSETS);
    assert.ok(
      json.length <= MAX_CONTEXT_CHARS,
      `context is ${json.length} chars, above the ${MAX_CONTEXT_CHARS} bound`,
    );
    assert.ok(JSON.parse(json), "truncated context must still be valid JSON");
  });

  test("reports no truncation for a small portfolio", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [asset({ id: "a1" })],
    });
    const { truncated, assetCount } = buildPortfolioContext(snapshot);
    assert.equal(truncated, false);
    assert.equal(assetCount, 1);
  });
});
