/**
 * Rule-based insight fallback tests.
 *
 * When GEMINI_API_KEY is missing or the provider fails, the dashboard falls
 * back to deterministic insights. These tests assert they are grounded in the
 * user's actual data, capped in number, honest about currencies, and that an
 * empty portfolio is handled.
 */
import "dotenv/config";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildRuleInsights } from "@/lib/ai-insights";
import { buildPortfolioSnapshot, type AssetRow } from "@/lib/portfolio";

const NOW = new Date("2026-10-27T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function asset(overrides: Partial<AssetRow> & { id: string }): AssetRow {
  return {
    title: `Asset ${overrides.id}`,
    category: "OTHER",
    providerName: "Provider",
    status: "ACTIVE",
    currency: "INR",
    estimatedValue: 100,
    valuationDate: daysAgo(1),
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    description: "some description",
    accountReference: "ref",
    ownershipEvidence: "proof",
    recoveryInstructions: "how to recover",
    valuationBasis: "basis",
    ...overrides,
  };
}

describe("rule-based insights", () => {
  test("every insight has a title, explanation, next step and a kind", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [asset({ id: "a1" }), asset({ id: "a2", valuationDate: daysAgo(200) })],
    });
    const insights = buildRuleInsights(snapshot);

    assert.ok(insights.length > 0);
    assert.ok(insights.length <= 5);
    for (const insight of insights) {
      assert.ok(insight.title.length > 0);
      assert.ok(insight.detail.length > 0);
      assert.ok(insight.nextStep.length > 0);
      assert.ok(insight.kind === "observation" || insight.kind === "suggestion");
      assert.equal(insight.source, "rules");
    }
  });

  test("flags stale valuations using the real asset title and age", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "a1", title: "Old Bitcoin wallet", valuationDate: daysAgo(210) }),
      ],
    });
    const insight = buildRuleInsights(snapshot).find(
      (entry) => entry.id === "rules-stale-valuations",
    );

    assert.ok(insight, "stale valuation insight missing");
    assert.ok(insight.detail.includes("Old Bitcoin wallet"));
    assert.ok(insight.detail.includes("210"));
    assert.equal(insight.kind, "observation");
  });

  test("reports documentation gaps as suggestions", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({
          id: "a1",
          title: "Bare asset",
          recoveryInstructions: null,
          ownershipEvidence: null,
        }),
      ],
    });
    const ids = buildRuleInsights(snapshot).map((entry) => entry.id);

    assert.ok(ids.includes("rules-recovery-docs"));
    assert.ok(ids.includes("rules-ownership-evidence"));
  });

  test("flags concentration only when one category holds at least half", () => {
    const concentrated = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "a1", category: "CRYPTO", estimatedValue: 80 }),
        asset({ id: "a2", category: "DOMAIN", estimatedValue: 20 }),
      ],
    });
    const concentratedIds = buildRuleInsights(concentrated).map((entry) => entry.id);
    assert.ok(concentratedIds.includes("rules-concentration"));

    const spread = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "b1", category: "CRYPTO", estimatedValue: 40 }),
        asset({ id: "b2", category: "DOMAIN", estimatedValue: 30 }),
        asset({ id: "b3", category: "GAMING", estimatedValue: 30 }),
      ],
    });
    const spreadIds = buildRuleInsights(spread).map((entry) => entry.id);
    assert.ok(!spreadIds.includes("rules-concentration"));
  });

  test("never combines different currencies into a single figure", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "a1", currency: "INR", estimatedValue: 100 }),
        asset({ id: "a2", currency: "USD", estimatedValue: 100 }),
      ],
    });
    const text = buildRuleInsights(snapshot)
      .map((entry) => `${entry.title} ${entry.detail} ${entry.nextStep}`)
      .join(" ");

    assert.ok(!text.includes("200"), "cross-currency total leaked into insights");
  });

  test("handles an empty portfolio with a single useful insight", () => {
    const snapshot = buildPortfolioSnapshot({ now: NOW, assets: [] });
    const insights = buildRuleInsights(snapshot);

    assert.equal(insights.length, 1);
    assert.equal(insights[0].id, "rules-empty-vault");
    assert.equal(insights[0].kind, "observation");
  });
});
