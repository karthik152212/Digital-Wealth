import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createAssetSchema,
  fieldErrorsFrom,
  updateAssetSchema,
} from "@/lib/asset-schemas";

function issuesOf(result: ReturnType<typeof createAssetSchema.safeParse>) {
  assert.equal(result.success, false, "expected validation to fail");
  if (result.success) return [];
  return result.error.issues;
}

describe("createAssetSchema", () => {
  const valid = {
    title: "Steam Game Library",
    category: "GAMING",
    providerName: "Steam",
    estimatedValue: 85000,
    currency: "INR",
  };

  test("accepts a valid payload and trims text", () => {
    const result = createAssetSchema.safeParse({
      ...valid,
      title: "  Steam Game Library  ",
      providerName: "  Steam  ",
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.title, "Steam Game Library");
      assert.equal(result.data.providerName, "Steam");
    }
  });

  test("rounds estimated value to two decimals", () => {
    const result = createAssetSchema.safeParse({
      ...valid,
      estimatedValue: 10.999,
    });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.estimatedValue, 11);
  });

  test("rejects an empty title", () => {
    const issues = issuesOf(createAssetSchema.safeParse({ ...valid, title: "   " }));
    assert.ok(issues.some((issue) => issue.path[0] === "title"));
  });

  test("rejects a title longer than 100 characters", () => {
    const issues = issuesOf(
      createAssetSchema.safeParse({ ...valid, title: "x".repeat(101) }),
    );
    assert.ok(issues.some((issue) => issue.path[0] === "title"));
  });

  test("rejects an unknown category", () => {
    const issues = issuesOf(
      createAssetSchema.safeParse({ ...valid, category: "STOCKS" }),
    );
    assert.ok(issues.some((issue) => issue.path[0] === "category"));
  });

  test("rejects an unsupported currency", () => {
    const issues = issuesOf(
      createAssetSchema.safeParse({ ...valid, currency: "JPY" }),
    );
    assert.ok(issues.some((issue) => issue.path[0] === "currency"));
  });

  test("rejects negative and non-numeric values", () => {
    assert.ok(
      issuesOf(
        createAssetSchema.safeParse({ ...valid, estimatedValue: -1 }),
      ).some((issue) => issue.path[0] === "estimatedValue"),
    );
    assert.ok(
      issuesOf(
        createAssetSchema.safeParse({ ...valid, estimatedValue: "100" }),
      ).some((issue) => issue.path[0] === "estimatedValue"),
    );
    assert.ok(
      issuesOf(
        createAssetSchema.safeParse({ ...valid, estimatedValue: null }),
      ).some((issue) => issue.path[0] === "estimatedValue"),
    );
  });

  test("rejects values above the supported limit", () => {
    assert.ok(
      issuesOf(
        createAssetSchema.safeParse({ ...valid, estimatedValue: 1e13 }),
      ).some((issue) => issue.path[0] === "estimatedValue"),
    );
  });

  test("rejects non-http URLs and accepts http(s)", () => {
    assert.ok(
      issuesOf(
        createAssetSchema.safeParse({
          ...valid,
          officialUrl: "javascript:alert(1)",
        }),
      ).some((issue) => issue.path[0] === "officialUrl"),
    );
    assert.equal(
      createAssetSchema.safeParse({
        ...valid,
        officialUrl: "https://store.steampowered.com",
      }).success,
      true,
    );
    assert.equal(
      createAssetSchema.safeParse({ ...valid, officialUrl: "" }).success,
      true,
      "empty URL means no link",
    );
  });

  test("strips client-supplied owner and demo fields (mass assignment)", () => {
    const result = createAssetSchema.safeParse({
      ...valid,
      ownerId: "someone-elses-user-id",
      isDemo: true,
      status: "ARCHIVED",
      id: "custom-id",
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(Object.keys(result.data).sort(), [
        "category",
        "currency",
        "estimatedValue",
        "providerName",
        "title",
      ]);
    }
  });
});

describe("updateAssetSchema", () => {
  test("accepts partial updates", () => {
    const result = updateAssetSchema.safeParse({ title: "New name" });
    assert.equal(result.success, true);
  });

  test("rejects an empty update", () => {
    const result = updateAssetSchema.safeParse({});
    assert.equal(result.success, false);
  });

  test("rejects unknown-only payloads such as ownerId", () => {
    const result = updateAssetSchema.safeParse({ ownerId: "attacker" });
    assert.equal(result.success, false, "ownerId must not count as an update");
  });

  test("accepts the status field with valid values only", () => {
    assert.equal(
      updateAssetSchema.safeParse({ status: "ARCHIVED" }).success,
      true,
    );
    assert.equal(
      updateAssetSchema.safeParse({ status: "DELETED" }).success,
      false,
    );
  });
});

describe("fieldErrorsFrom", () => {
  test("maps issues to a field-keyed record", () => {
    const result = createAssetSchema.safeParse({
      title: "",
      category: "STOCKS",
      providerName: "",
      estimatedValue: -1,
      currency: "JPY",
    });
    assert.equal(result.success, false);
    if (result.success) return;
    const fields = fieldErrorsFrom(result.error);
    assert.ok(fields.title);
    assert.ok(fields.category);
    assert.ok(fields.providerName);
    assert.ok(fields.estimatedValue);
    assert.ok(fields.currency);
  });
});
