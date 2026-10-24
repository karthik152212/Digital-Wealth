import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createNomineeSchema,
  fieldErrorsFrom,
  inviteRequestSchema,
  nomineeIdSchema,
  updateNomineeSchema,
} from "@/lib/nominee-schemas";

describe("createNomineeSchema", () => {
  test("accepts a valid nominee with relationship", () => {
    const parsed = createNomineeSchema.safeParse({
      name: "Maya Iqbal",
      email: "maya@example.com",
      relationship: "Sibling",
    });
    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.data, {
      name: "Maya Iqbal",
      email: "maya@example.com",
      relationship: "Sibling",
    });
  });

  test("accepts a valid nominee without relationship", () => {
    const parsed = createNomineeSchema.safeParse({
      name: "Maya",
      email: "maya@example.com",
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.relationship, undefined);
  });

  test("trims whitespace and lowercases the email", () => {
    const parsed = createNomineeSchema.safeParse({
      name: "  Maya Iqbal  ",
      email: "  Maya@Example.COM ",
      relationship: "  Sibling  ",
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.name, "Maya Iqbal");
    assert.equal(parsed.data?.email, "maya@example.com");
    assert.equal(parsed.data?.relationship, "Sibling");
  });

  test("rejects a missing name", () => {
    const parsed = createNomineeSchema.safeParse({
      email: "maya@example.com",
    });
    assert.equal(parsed.success, false);
    assert.ok(
      parsed.error?.issues.some(
        (issue) => issue.path[0] === "name" && issue.message === "Nominee name is required.",
      ),
    );
  });

  test("rejects an empty or overlong name", () => {
    const empty = createNomineeSchema.safeParse({
      name: "   ",
      email: "maya@example.com",
    });
    assert.equal(empty.success, false);

    const long = createNomineeSchema.safeParse({
      name: "x".repeat(81),
      email: "maya@example.com",
    });
    assert.equal(long.success, false);
  });

  test("rejects a missing or invalid email", () => {
    const missing = createNomineeSchema.safeParse({ name: "Maya" });
    assert.equal(missing.success, false);
    assert.ok(
      missing.error?.issues.some((issue) => issue.path[0] === "email"),
    );

    for (const email of ["not-an-email", "a@b", "@example.com", "a b@c.com"]) {
      const parsed = createNomineeSchema.safeParse({ name: "Maya", email });
      assert.equal(parsed.success, false, `expected ${email} to be rejected`);
    }
  });

  test("rejects an email longer than 254 characters", () => {
    const parsed = createNomineeSchema.safeParse({
      name: "Maya",
      email: `${"a".repeat(250)}@example.com`,
    });
    assert.equal(parsed.success, false);
  });

  test("rejects an overlong relationship", () => {
    const parsed = createNomineeSchema.safeParse({
      name: "Maya",
      email: "maya@example.com",
      relationship: "x".repeat(81),
    });
    assert.equal(parsed.success, false);
  });

  test("strips client-supplied ownership and internal fields", () => {
    const parsed = createNomineeSchema.safeParse({
      name: "Maya",
      email: "maya@example.com",
      ownerId: "someone-else",
      isDemo: true,
      status: "REVOKED",
      revokedAt: "2026-01-01T00:00:00.000Z",
      id: "client-supplied-id",
    });
    assert.equal(parsed.success, true);
    assert.deepEqual(Object.keys(parsed.data ?? {}).sort(), ["email", "name"]);
  });
});

describe("updateNomineeSchema", () => {
  test("accepts name-only, relationship-only and restore updates", () => {
    const nameOnly = updateNomineeSchema.safeParse({ name: "New Name" });
    assert.equal(nameOnly.success, true);

    const relOnly = updateNomineeSchema.safeParse({ relationship: "Friend" });
    assert.equal(relOnly.success, true);

    const clearRel = updateNomineeSchema.safeParse({ relationship: "" });
    assert.equal(clearRel.success, true);

    const restore = updateNomineeSchema.safeParse({ status: "ACTIVE" });
    assert.equal(restore.success, true);
    assert.equal(restore.data?.status, "ACTIVE");
  });

  test("rejects an empty update", () => {
    const parsed = updateNomineeSchema.safeParse({});
    assert.equal(parsed.success, false);
  });

  test("rejects status REVOKED on PATCH (revoke has a dedicated endpoint)", () => {
    const parsed = updateNomineeSchema.safeParse({ status: "REVOKED" });
    assert.equal(parsed.success, false);
  });

  test("rejects any client-supplied email change", () => {
    const parsed = updateNomineeSchema.safeParse({
      name: "Maya",
      email: "changed@example.com",
    });
    assert.equal(parsed.success, false);
    assert.ok(
      parsed.error?.issues.some(
        (issue) =>
          issue.path[0] === "email" &&
          issue.message === "Email cannot be changed after creation.",
      ),
    );

    const emailOnly = updateNomineeSchema.safeParse({
      email: "changed@example.com",
    });
    assert.equal(emailOnly.success, false);
  });

  test("strips client-supplied ownership fields while keeping real ones", () => {
    const parsed = updateNomineeSchema.safeParse({
      name: "Maya",
      ownerId: "someone-else",
      isDemo: true,
      id: "hijack",
    });
    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.data, { name: "Maya" });
  });

  test("fieldErrorsFrom maps nominee issues to field-keyed messages", () => {
    const parsed = createNomineeSchema.safeParse({ name: "", email: "bad" });
    assert.equal(parsed.success, false);
    const fields = fieldErrorsFrom(parsed.error!);
    assert.ok(fields.name);
    assert.ok(fields.email);
  });
});

describe("inviteRequestSchema and nomineeIdSchema", () => {
  test("accepts a valid nominee id and trims it", () => {
    const parsed = inviteRequestSchema.safeParse({
      nomineeId: "  demo__nominee_ada_maya  ",
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.nomineeId, "demo__nominee_ada_maya");
  });

  test("rejects a missing, empty or overlong nominee id", () => {
    assert.equal(inviteRequestSchema.safeParse({}).success, false);
    assert.equal(inviteRequestSchema.safeParse({ nomineeId: "" }).success, false);
    assert.equal(
      inviteRequestSchema.safeParse({ nomineeId: "x".repeat(65) }).success,
      false,
    );
    assert.equal(nomineeIdSchema.safeParse("   ").success, false);
  });
});
