import "dotenv/config";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  generateClaimCode,
  hashClaimCode,
  verifyClaimCode,
} from "@/lib/claim-code";
import {
  declineRequestSchema,
  initiateClaimSchema,
  rejectClaimSchema,
  requestIdSchema,
  submitClaimSchema,
} from "@/lib/inheritance-schemas";

describe("initiateClaimSchema", () => {
  test("requires the attestation literal", () => {
    const result = initiateClaimSchema.safeParse({});
    assert.equal(result.success, false);
  });

  test("rejects a false attestation", () => {
    const result = initiateClaimSchema.safeParse({ attestation: false });
    assert.equal(result.success, false);
  });

  test("accepts attestation without a claim code", () => {
    const result = initiateClaimSchema.safeParse({ attestation: true });
    assert.equal(result.success, true);
  });

  test("accepts attestation with a claim code", () => {
    const result = initiateClaimSchema.safeParse({
      attestation: true,
      claimCode: "abc-123",
    });
    assert.equal(result.success, true);
  });

  test("trims the claim code and rejects empty codes", () => {
    const ok = initiateClaimSchema.safeParse({
      attestation: true,
      claimCode: "  code-x  ",
    });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.claimCode, "code-x");

    const empty = initiateClaimSchema.safeParse({
      attestation: true,
      claimCode: "   ",
    });
    assert.equal(empty.success, false);
  });

  test("rejects claim codes over 128 characters", () => {
    const result = initiateClaimSchema.safeParse({
      attestation: true,
      claimCode: "x".repeat(129),
    });
    assert.equal(result.success, false);
  });
});

describe("submitClaimSchema", () => {
  test("requires the attestation literal", () => {
    assert.equal(submitClaimSchema.safeParse({}).success, false);
    assert.equal(submitClaimSchema.safeParse({ attestation: false }).success, false);
    assert.equal(submitClaimSchema.safeParse({ attestation: true }).success, true);
  });
});

describe("declineRequestSchema", () => {
  test("accepts an empty body", () => {
    assert.equal(declineRequestSchema.safeParse({}).success, true);
  });

  test("accepts an optional trimmed reason", () => {
    const result = declineRequestSchema.safeParse({ reason: "  not ready  " });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.reason, "not ready");
  });

  test("rejects reasons over 500 characters", () => {
    const result = declineRequestSchema.safeParse({ reason: "x".repeat(501) });
    assert.equal(result.success, false);
  });
});

describe("rejectClaimSchema", () => {
  test("accepts an empty body and an optional reason", () => {
    assert.equal(rejectClaimSchema.safeParse({}).success, true);
    const withReason = rejectClaimSchema.safeParse({ reason: "still in control" });
    assert.equal(withReason.success, true);
  });

  test("rejects reasons over 500 characters", () => {
    assert.equal(
      rejectClaimSchema.safeParse({ reason: "x".repeat(501) }).success,
      false,
    );
  });
});

describe("requestIdSchema", () => {
  test("requires a non-empty id up to 64 characters", () => {
    assert.equal(requestIdSchema.safeParse("").success, false);
    assert.equal(requestIdSchema.safeParse("   ").success, false);
    assert.equal(requestIdSchema.safeParse("x".repeat(65)).success, false);
    assert.equal(requestIdSchema.safeParse("req-1").success, true);
  });
});

describe("claim code hashing", () => {
  test("generateClaimCode returns a high-entropy one-time value", () => {
    const a = generateClaimCode();
    const b = generateClaimCode();
    assert.notEqual(a, b);
    assert.ok(a.length >= 16, `expected >= 16 chars, got ${a.length}`);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });

  test("hashClaimCode stores only a salted scrypt hash", () => {
    const code = generateClaimCode();
    const stored = hashClaimCode(code);
    assert.ok(!stored.includes(code), "plaintext must never appear in the hash");
    const [salt, hash] = stored.split(":");
    assert.ok(salt && hash);
    assert.equal(salt.length, 32);
    assert.equal(hash.length, 64);
  });

  test("verifyClaimCode accepts the correct code and rejects others", () => {
    const code = generateClaimCode();
    const stored = hashClaimCode(code);
    assert.equal(verifyClaimCode(code, stored), true);
    assert.equal(verifyClaimCode(`${code}x`, stored), false);
    assert.equal(verifyClaimCode("wrong-code", stored), false);
  });

  test("hashing the same code twice yields different stored values", () => {
    const code = generateClaimCode();
    assert.notEqual(hashClaimCode(code), hashClaimCode(code));
  });

  test("verifyClaimCode fails safely on malformed stored values", () => {
    assert.equal(verifyClaimCode("anything", "not-a-hash"), false);
    assert.equal(verifyClaimCode("anything", ""), false);
  });
});
