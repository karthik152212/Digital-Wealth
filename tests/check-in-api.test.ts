/**
 * Check-in API regression tests (inactivity "Keep it active" card).
 *
 * Coverage:
 *  - Unauthenticated requests are rejected (401).
 *  - Unverified accounts are rejected (403) — email verification stays enforced.
 *  - Authenticated check-in persists lastSeenAt for the session's own user.
 *  - The endpoint ignores client-supplied user ids: posting another user's
 *    id in the body must not touch that user's record (ownership enforcement).
 *  - Rapid duplicate/concurrent submissions cannot corrupt state.
 */
import "dotenv/config";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { prisma } from "@/lib/prisma";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
// Unique simulated client IP so auth rate limits are isolated per suite.
const TEST_IP = "198.51.100.14";

const OWNER_EMAIL = "checkin-test-owner@example.com";
const OTHER_EMAIL = "checkin-test-other@example.com";
const VERIFICATION_TEST_EMAIL = "checkin-test-unverified@example.com";
const TEST_PASSWORD = "Checkin-Test-Pass-9021!";

type Env = {
  cookie: string;
  userId: string;
  otherCookie: string;
  otherUserId: string;
};

const env: Env = {
  cookie: "",
  userId: "",
  otherCookie: "",
  otherUserId: "",
};

function cookieHeader(response: Response): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

async function signUpAndSignIn(
  email: string,
  name: string,
): Promise<{ cookie: string; userId: string }> {
  const signUpRes = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
      "X-Forwarded-For": TEST_IP,
    },
    body: JSON.stringify({ email, name, password: TEST_PASSWORD }),
  });
  assert.equal(
    signUpRes.status,
    200,
    `sign-up for ${email} returned ${signUpRes.status}`,
  );

  // Email verification is enforced server-side; test accounts are marked
  // verified directly (same recipe as the other API suites).
  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { emailVerified: true },
  });

  const signInRes = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
      "X-Forwarded-For": TEST_IP,
    },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  assert.equal(
    signInRes.status,
    200,
    `sign-in for ${email} returned ${signInRes.status}`,
  );
  const cookie = cookieHeader(signInRes);
  assert.ok(cookie, "expected a session cookie from sign-in");

  const sessionRes = await fetch(`${BASE}/api/auth/get-session`, {
    headers: { Cookie: cookie, "X-Forwarded-For": TEST_IP },
  });
  const session = (await sessionRes.json()) as { user?: { id?: string } };
  assert.ok(session?.user?.id, "expected a session user id");
  return { cookie, userId: session.user!.id! };
}

function api(options: {
  method?: string;
  cookie?: string;
  body?: unknown;
}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${BASE}/api/check-in`, {
    method: options.method ?? "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

describe("check-in API", () => {
  before(async () => {
    // Idempotent cleanup from any earlier run of this suite.
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [OWNER_EMAIL, OTHER_EMAIL, VERIFICATION_TEST_EMAIL],
        },
      },
    });
    const owner = await signUpAndSignIn(OWNER_EMAIL, "Checkin Suite Owner");
    env.cookie = owner.cookie;
    env.userId = owner.userId;
    const other = await signUpAndSignIn(OTHER_EMAIL, "Checkin Suite Other");
    env.otherCookie = other.cookie;
    env.otherUserId = other.userId;
  });

  after(async () => {
    // Remove only the records this suite created.
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [OWNER_EMAIL, OTHER_EMAIL, VERIFICATION_TEST_EMAIL],
        },
      },
    });
  });

  test("rejects unauthenticated requests with 401", async () => {
    const res = await api({ method: "POST" });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "Unauthorized");
  });

  test("rejects unverified accounts with 403", async () => {
    const { cookie } = await signUpAndSignIn(
      VERIFICATION_TEST_EMAIL,
      "Checkin Suite Unverified",
    );
    // Demote this throwaway account to unverified for the 403 case.
    await prisma.user.update({
      where: { email: VERIFICATION_TEST_EMAIL.toLowerCase() },
      data: { emailVerified: false },
    });
    const res = await api({ method: "POST", cookie });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "Email verification required.");
  });

  test("persists a fresh lastSeenAt for the session's own user", async () => {
    const res = await api({ method: "POST", cookie: env.cookie });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });

    const user = await prisma.user.findUnique({ where: { id: env.userId } });
    assert.ok(user?.lastSeenAt, "lastSeenAt must be persisted");
    const ageSeconds = Math.floor(
      (Date.now() - user.lastSeenAt.getTime()) / 1000,
    );
    assert.ok(
      ageSeconds >= 0 && ageSeconds < 60,
      `expected a very recent lastSeenAt, got ${ageSeconds}s old`,
    );
  });

  test("ignores client-supplied user ids (ownership enforcement)", async () => {
    const otherBefore = await prisma.user.findUnique({
      where: { id: env.otherUserId },
    });
    const otherPrevious = otherBefore?.lastSeenAt ?? null;

    // Attempt to target the other user's record via the body.
    const res = await api({
      method: "POST",
      cookie: env.cookie,
      body: { userId: env.otherUserId },
    });
    assert.equal(res.status, 200);

    const otherAfter = await prisma.user.findUnique({
      where: { id: env.otherUserId },
    });
    assert.equal(otherAfter?.lastSeenAt?.toISOString() ?? null, otherPrevious?.toISOString() ?? null,
      "another user's lastSeenAt must never change");

    // Own record is still the only one updated.
    const own = await prisma.user.findUnique({ where: { id: env.userId } });
    assert.ok(own?.lastSeenAt);
  });

  test("concurrent duplicate submissions stay consistent", async () => {
    const [a, b] = await Promise.all([
      api({ method: "POST", cookie: env.cookie }),
      api({ method: "POST", cookie: env.cookie }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);

    const user = await prisma.user.findUnique({ where: { id: env.userId } });
    assert.ok(user?.lastSeenAt);
    const ageSeconds = Math.floor(
      (Date.now() - user.lastSeenAt.getTime()) / 1000,
    );
    assert.ok(ageSeconds < 60, "lastSeenAt must remain a fresh, valid timestamp");
  });
});
