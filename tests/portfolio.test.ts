/**
 * Portfolio calculation tests.
 *
 * These cover the non-negotiable financial rules:
 *  - totals are never summed across currencies,
 *  - counts and category distribution use only the caller's own active records,
 *  - empty portfolios and missing valuation dates are handled,
 *  - stale valuations are detected,
 *  - historical change is only produced when real valuation records exist.
 *
 * Pure builders only — no network, no server, no provider calls.
 */
import "dotenv/config";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  STALE_AFTER_DAYS,
  buildPortfolioSnapshot,
  type AssetRow,
  type ValuationRow,
} from "@/lib/portfolio";

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
    estimatedValue: 0,
    valuationDate: NOW,
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("portfolio totals", () => {
  test("never sums different currencies into one total", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "a1", estimatedValue: 100, currency: "INR" }),
        asset({ id: "a2", estimatedValue: 50, currency: "INR" }),
        asset({ id: "a3", estimatedValue: 20, currency: "USD" }),
        asset({ id: "a4", estimatedValue: 5, currency: "EUR" }),
      ],
    });

    assert.deepEqual(snapshot.totalsByCurrency, [
      { currency: "EUR", total: 5 },
      { currency: "INR", total: 150 },
      { currency: "USD", total: 20 },
    ]);

    // 170 (150 + 20) would be the misleading cross-currency total.
    const raw = JSON.stringify(snapshot.totalsByCurrency);
    assert.ok(!raw.includes("170"), "cross-currency total leaked into output");
    assert.equal(snapshot.hasLiveData, false);
  });

  test("counts only the caller's active records", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "a1", estimatedValue: 100, status: "ACTIVE" }),
        asset({ id: "a2", estimatedValue: 999, status: "ARCHIVED" }),
      ],
    });

    assert.equal(snapshot.assetCount, 1);
    assert.equal(snapshot.archivedCount, 1);
    assert.deepEqual(snapshot.totalsByCurrency, [{ currency: "INR", total: 100 }]);
    // Archived assets stay visible in the list but never in the totals.
    assert.equal(snapshot.assets.length, 2);
  });

  test("category distribution groups active assets per currency", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "a1", category: "CRYPTO", estimatedValue: 40, currency: "INR" }),
        asset({ id: "a2", category: "CRYPTO", estimatedValue: 10, currency: "INR" }),
        asset({ id: "a3", category: "DOMAIN", estimatedValue: 30, currency: "INR" }),
        asset({ id: "a4", category: "DOMAIN", estimatedValue: 7, currency: "USD" }),
        asset({ id: "a5", category: "DOMAIN", estimatedValue: 500, status: "ARCHIVED" }),
      ],
    });

    const crypto = snapshot.categories.find((entry) => entry.category === "CRYPTO");
    const domain = snapshot.categories.find((entry) => entry.category === "DOMAIN");

    assert.equal(crypto?.count, 2);
    assert.deepEqual(crypto?.totals, [{ currency: "INR", total: 50 }]);

    assert.equal(domain?.count, 2);
    assert.deepEqual(domain?.totals, [
      { currency: "INR", total: 30 },
      { currency: "USD", total: 7 },
    ]);

    // Percentages of a currency must add up to 100 for that currency.
    const inrTotal = snapshot.totalsByCurrency.find((t) => t.currency === "INR")?.total;
    assert.equal(inrTotal, 80);
    const shareSum =
      ((crypto?.totals[0].total ?? 0) + (domain?.totals[0].total ?? 0)) / (inrTotal ?? 1);
    assert.ok(Math.abs(shareSum - 1) < 1e-9);
  });

  test("handles an empty portfolio", () => {
    const snapshot = buildPortfolioSnapshot({ now: NOW, assets: [] });

    assert.equal(snapshot.assetCount, 0);
    assert.deepEqual(snapshot.totalsByCurrency, []);
    assert.deepEqual(snapshot.categories, []);
    assert.deepEqual(snapshot.history, []);
    assert.equal(snapshot.health.staleCount, 0);
    assert.equal(snapshot.health.activeCount, 0);
  });
});

describe("valuation status", () => {
  test("flags a valuation older than the staleness threshold", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [
        asset({ id: "fresh", valuationDate: daysAgo(5) }),
        asset({ id: "stale", valuationDate: daysAgo(STALE_AFTER_DAYS + 1) }),
        asset({ id: "edge", valuationDate: daysAgo(STALE_AFTER_DAYS) }),
      ],
    });

    const byId = new Map(snapshot.assets.map((entry) => [entry.id, entry]));
    assert.equal(byId.get("fresh")?.freshness, "CURRENT");
    assert.equal(byId.get("stale")?.freshness, "STALE");
    assert.equal(byId.get("edge")?.freshness, "CURRENT");
    assert.equal(snapshot.health.staleCount, 1);
  });

  test("handles missing valuation dates without crashing", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [asset({ id: "nodate", valuationDate: null })],
    });

    const entry = snapshot.assets[0];
    assert.equal(entry.valuationDate, null);
    assert.equal(entry.valuationAgeDays, null);
    assert.equal(entry.freshness, "UNKNOWN_DATE");
    assert.equal(snapshot.health.missingDateCount, 1);
    assert.deepEqual(snapshot.totalsByCurrency, [{ currency: "INR", total: 0 }]);
  });

  test("marks every valuation as manually entered (no market data source)", () => {
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: [asset({ id: "a1", estimatedValue: 10 })],
    });
    assert.equal(snapshot.assets[0].valuationSource, "MANUAL");
    assert.equal(snapshot.hasLiveData, false);
  });
});

describe("historical valuation change", () => {
  const historyAssets = [
    asset({ id: "a1", estimatedValue: 200, currency: "INR" }),
    asset({ id: "a2", estimatedValue: 50, currency: "INR" }),
  ];

  test("is absent when no valuation records exist", () => {
    const snapshot = buildPortfolioSnapshot({ now: NOW, assets: historyAssets });
    assert.deepEqual(snapshot.history, []);
    assert.equal(snapshot.health.assetsWithHistory, 0);
  });

  test("is absent when an asset has only one recorded valuation", () => {
    const valuations: ValuationRow[] = [
      { assetId: "a1", value: 100, currency: "INR", valuedAt: daysAgo(30) },
    ];
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: historyAssets,
      valuations,
    });
    assert.deepEqual(snapshot.history, []);
  });

  test("is computed from two real recorded valuations", () => {
    const valuations: ValuationRow[] = [
      { assetId: "a1", value: 100, currency: "INR", valuedAt: daysAgo(60) },
      { assetId: "a1", value: 200, currency: "INR", valuedAt: daysAgo(5) },
    ];
    const snapshot = buildPortfolioSnapshot({
      now: NOW,
      assets: historyAssets,
      valuations,
    });

    assert.equal(snapshot.history.length, 1);
    const [entry] = snapshot.history;
    assert.equal(entry.currency, "INR");
    assert.equal(entry.earliest.value, 100);
    assert.equal(entry.latest.value, 200);
    assert.equal(entry.delta, 100);
    assert.equal(entry.assetsWithHistory, 1);
    assert.equal(entry.assetsTotal, 2);
  });
});

describe("fingerprint", () => {
  test("changes when a saved value changes", () => {
    const before = buildPortfolioSnapshot({
      now: NOW,
      assets: [asset({ id: "a1", estimatedValue: 100 })],
    });
    const after = buildPortfolioSnapshot({
      now: NOW,
      assets: [asset({ id: "a1", estimatedValue: 101 })],
    });

    assert.notEqual(before.fingerprint, after.fingerprint);
  });

  test("stays stable for identical data", () => {
    const a = buildPortfolioSnapshot({ now: NOW, assets: [asset({ id: "a1" })] });
    const b = buildPortfolioSnapshot({ now: NOW, assets: [asset({ id: "a1" })] });
    assert.equal(a.fingerprint, b.fingerprint);
  });
});
