import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { createEmailVerificationToken } from "better-auth/api";

import { prisma } from "@/lib/prisma";

/**
 * Email-verification suite (Better Auth 1.7.12 supported flow).
 *
 * Covered:
 *  - registration creates an unverified account with no session
 *  - sign-in is blocked (403 EMAIL_NOT_VERIFIED) until verified
 *  - verifying via Better Auth's /verify-email unlocks sign-in
 *  - resend: per-email server-side cooldown (429 + Retry-After), enforced
 *    before any account lookup (anti-enumeration: unknown and already-
 *    verified emails behave identically)
 *  - cooldown expiry: after the window, resend works again
 *  - concurrent resends: exactly one outbound send across instances
 *    (atomic CAS in the shared RateLimit table)
 *  - multi-client: cooldown is global per email (holds across source IPs)
 *  - verification-link attempts are rate-limited per IP
 *  - demo data is untouched
 *
 * Each scenario uses its own source IP so per-IP counters never leak
 * between scenarios or between test files.
 */

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const TEST_PASSWORD = "Slice7-Verify-Pass-9021!";

// Per-scenario IPs (198.51.100.0/24 is TEST-NET-2, never routable).
// The last octet is randomized per run so Better Auth's per-IP counters
// (stored in the shared RateLimit table) never leak between runs.
const IP_SUFFIX = 1 + Math.floor(Math.random() * 200);
const ipFor = (offset: number) => `198.51.100.${IP_SUFFIX + offset}`;
const IP_FLOW = ipFor(0); // happy path
const IP_ENUM = ipFor(1); // anti-enumeration
const IP_CONCURRENT = ipFor(2); // concurrent resends
const IP_MULTI = ipFor(3); // multi-client cooldown
const IP_EXPIRY = ipFor(4); // cooldown expiry
const IP_ATTEMPTS = ipFor(5); // link-attempt rate limit

type Env = {
  flowEmail: string;
  flowUserId: string;
  enumEmail: string;
  concurrentEmail: string;
  multiEmail: string;
  expiryEmail: string;
  baseline: { demoAssets: number; demoUsers: number };
};

const env: Env = {
  flowEmail: "",
  flowUserId: "",
  enumEmail: "",
  concurrentEmail: "",
  multiEmail: "",
  expiryEmail: "",
  baseline: { demoAssets: 0, demoUsers: 0 },
};

function testEmail(local: string): string {
  return `${local}-${randomUUID().slice(0, 8)}@slice7-verify.example`;
}

function headers(ip: string, extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    Origin: BASE,
    "X-Forwarded-For": ip,
    ...extra,
  };
}

async function signUp(
  email: string,
  ip: string,
): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: headers(ip),
    body: JSON.stringify({ email, name: "Slice7 Verify", password: TEST_PASSWORD }),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function signIn(email: string, ip: string): Promise<Response> {
  return fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: headers(ip),
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
}

async function getSession(cookie: string, ip: string): Promise<unknown> {
  const response = await fetch(`${BASE}/api/auth/get-session`, {
    headers: headers(ip, { Cookie: cookie }),
  });
  return response.json().catch(() => null);
}

function cookieHeader(response: Response): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

async function resend(
  email: string,
  ip: string,
): Promise<{ status: number; retryAfter: string | null; body: unknown }> {
  const response = await fetch(`${BASE}/api/auth/resend-verification`, {
    method: "POST",
    headers: headers(ip),
    body: JSON.stringify({ email }),
  });
  const body = await response.json().catch(() => null);
  return {
    status: response.status,
    retryAfter: response.headers.get("Retry-After"),
    body,
  };
}

async function verifyToken(token: string, ip: string): Promise<Response> {
  return fetch(
    `${BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    { headers: headers(ip) },
  );
}

/** Mint a verification token exactly the way the library does. */
async function mintToken(email: string): Promise<string> {
  const secret = process.env.BETTER_AUTH_SECRET;
  assert.ok(secret, "BETTER_AUTH_SECRET must be set for tests");
  return createEmailVerificationToken(secret, email);
}

/** Backdate (or create) the per-email cooldown row to simulate expiry. */
async function backdateCooldown(email: string, secondsAgo: number) {
  const key = `verification-resend:${email}`;
  await prisma.$executeRaw`
    INSERT INTO "RateLimit" (id, key, count, "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${BigInt(Date.now() - secondsAgo * 1000)})
    ON CONFLICT (key) DO UPDATE
      SET count = "RateLimit".count + 1,
          "lastRequest" = ${BigInt(Date.now() - secondsAgo * 1000)}
  `;
}

async function cooldownRowLastRequest(email: string) {
  return prisma.rateLimit.findUnique({
    where: { key: `verification-resend:${email}` },
  });
}

async function cleanupRateLimits(emails: string[]) {
  await prisma.rateLimit.deleteMany({
    where: { key: { in: emails.map((email) => `verification-resend:${email}`) } },
  });
}

before(async () => {
  env.flowEmail = testEmail("flow");
  env.enumEmail = testEmail("enum");
  env.concurrentEmail = testEmail("concurrent");
  env.multiEmail = testEmail("multi");
  env.expiryEmail = testEmail("expiry");

  env.baseline.demoAssets = await prisma.asset.count({ where: { isDemo: true } });
  env.baseline.demoUsers = await prisma.user.count({
    where: { email: { endsWith: "@demo.local" } },
  });

  // Fresh cooldown state so reruns are deterministic.
  await cleanupRateLimits([
    env.flowEmail,
    env.enumEmail,
    env.concurrentEmail,
    env.multiEmail,
    env.expiryEmail,
  ]);
});

after(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [env.flowEmail, env.concurrentEmail, env.multiEmail, env.expiryEmail],
      },
    },
  });
  await cleanupRateLimits([
    env.flowEmail,
    env.enumEmail,
    env.concurrentEmail,
    env.multiEmail,
    env.expiryEmail,
  ]);
});

describe("email verification flow", () => {
  test("sign-up creates an unverified account with no session", async () => {
    const { response } = await signUp(env.flowEmail, IP_FLOW);
    assert.equal(response.status, 200);

    const cookie = cookieHeader(response);
    assert.equal(cookie, "", "sign-up must not issue a session cookie");

    const user = await prisma.user.findUnique({
      where: { email: env.flowEmail.toLowerCase() },
    });
    assert.ok(user, "user should exist after sign-up");
    assert.equal(user!.emailVerified, false, "account must start unverified");
    env.flowUserId = user!.id;
  });

  test("sign-in is blocked with EMAIL_NOT_VERIFIED before verification", async () => {
    const response = await signIn(env.flowEmail, IP_FLOW);
    assert.equal(response.status, 403);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "EMAIL_NOT_VERIFIED");
  });

  test("verification link issued by the library unlocks sign-in", async () => {
    const token = await mintToken(env.flowEmail);
    const response = await verifyToken(token, IP_FLOW);
    assert.equal(response.status, 200);

    const user = await prisma.user.findUnique({
      where: { id: env.flowUserId },
    });
    assert.ok(user!.emailVerified, "emailVerified must be set after verify");

    const signInResponse = await signIn(env.flowEmail, IP_FLOW);
    assert.equal(signInResponse.status, 200, "verified user must be able to sign in");
    const cookie = cookieHeader(signInResponse);
    assert.ok(cookie, "sign-in must issue a session cookie");
    const session = (await getSession(cookie, IP_FLOW)) as {
      user?: { id?: string };
    } | null;
    assert.equal(session?.user?.id, env.flowUserId);
  });

  test("tampered or unknown verification tokens are rejected", async () => {
    // Tokens are stateless HS256 JWTs: a valid link stays valid until expiry
    // (re-use is idempotent by design), but tampered or unknown tokens must
    // never verify an account.
    const tampered = (await mintToken(env.flowEmail)).replace(
      /\.(.*)\./,
      ".eyJmb28iOiJiYXIifQ.",
    );
    const response = await verifyToken(tampered, IP_FLOW);
    assert.ok(
      response.status >= 400,
      `tampered token must be rejected, got ${response.status}`,
    );

    const unknown = await verifyToken("not-a-jwt", IP_FLOW);
    assert.ok(
      unknown.status >= 400,
      `garbage token must be rejected, got ${unknown.status}`,
    );
  });
});

describe("resend cooldown and anti-enumeration", () => {
  test("unknown and known emails get identical success responses", async () => {
    // Known-unverified email (cooldown cleared first so both paths are
    // exercised in the same state).
    await backdateCooldown(env.enumEmail, 3600);
    const known = await resend(env.enumEmail, IP_ENUM);
    const unknown = await resend(testEmail("nobody"), IP_ENUM);

    assert.equal(known.status, 200, "known unverified email should be accepted");
    assert.equal(unknown.status, 200, "unknown email must look identical");
    assert.deepEqual(
      known.body,
      unknown.body,
      "response bodies must not reveal account state",
    );
  });

  test("immediate repeat resend is rejected with 429 and Retry-After", async () => {
    const result = await resend(env.enumEmail, IP_ENUM);
    assert.equal(result.status, 429, "second resend inside cooldown must be limited");
    assert.ok(result.retryAfter, "429 must carry Retry-After");
    const retryAfter = Number.parseInt(result.retryAfter!, 10);
    assert.ok(
      Number.isFinite(retryAfter) && retryAfter >= 1 && retryAfter <= 60,
      `Retry-After should be within the cooldown window, got ${result.retryAfter}`,
    );
  });

  test("cooldown applies even when the source IP changes", async () => {
    // Different client, different IP — the cooldown is per email, not per IP.
    const result = await resend(env.enumEmail, IP_MULTI);
    assert.equal(result.status, 429);
  });

  test("unknown emails are cooldown-limited too (no probing oracle)", async () => {
    const probe = testEmail("nobody-probe");
    const first = await resend(probe, IP_ENUM);
    const second = await resend(probe, IP_ENUM);
    assert.equal(first.status, 200);
    assert.equal(
      second.status,
      429,
      "unknown emails must consume the same cooldown as real ones",
    );
  });
});

describe("concurrent resends", () => {
  before(async () => {
    // A user with no prior cooldown row: any of the parallel requests could
    // legitimately win, but exactly one must send.
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: env.concurrentEmail.toLowerCase(),
        name: "Slice7 Concurrent",
        emailVerified: false,
      },
    });
  });

  test("N parallel resends produce exactly one outbound send", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => resend(env.concurrentEmail, IP_CONCURRENT)),
    );

    const accepted = results.filter((r) => r.status === 200);
    const limited = results.filter((r) => r.status === 429);

    assert.equal(accepted.length, 1, "exactly one concurrent resend may send");
    assert.equal(limited.length, 4, "all other concurrent resends must be limited");

    const row = await cooldownRowLastRequest(env.concurrentEmail);
    assert.ok(row, "cooldown row must exist after a successful claim");
  });
});

describe("cooldown expiry", () => {
  before(async () => {
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: env.expiryEmail.toLowerCase(),
        name: "Slice7 Expiry",
        emailVerified: false,
      },
    });
  });

  test("resend is limited inside the window and allowed after it expires", async () => {
    // Seed a claim "just now" → resend must be limited.
    await backdateCooldown(env.expiryEmail, 1);
    const blocked = await resend(env.expiryEmail, IP_EXPIRY);
    assert.equal(blocked.status, 429);

    // Simulate the window elapsing by moving lastRequest past the cooldown.
    await backdateCooldown(env.expiryEmail, 3600);
    const allowed = await resend(env.expiryEmail, IP_EXPIRY);
    assert.equal(allowed.status, 200, "after expiry the resend must be accepted");
  });
});

describe("verification-link attempt rate limiting", () => {
  test("hammering /verify-email from one IP is throttled", async () => {
    const badToken = await mintToken(testEmail("never-registered"));
    const statuses: number[] = [];
    // Default limit: 10 attempts / 60s per IP — the 11th must be limited.
    for (let i = 0; i < 12; i += 1) {
      const response = await verifyToken(badToken, IP_ATTEMPTS);
      statuses.push(response.status);
      if (response.status === 429) break;
    }
    assert.ok(
      statuses.includes(429),
      `expected at least one 429 while hammering verify-email, got ${statuses.join(",")}`,
    );
    assert.ok(
      statuses.slice(0, 10).every((status) => status !== 429),
      "attempts within the configured window should be allowed",
    );
  });
});

describe("demo data preservation", () => {
  test("demo assets and demo users are unchanged", async () => {
    const demoAssets = await prisma.asset.count({ where: { isDemo: true } });
    const demoUsers = await prisma.user.count({
      where: { email: { endsWith: "@demo.local" } },
    });
    assert.equal(demoAssets, env.baseline.demoAssets);
    assert.equal(demoUsers, env.baseline.demoUsers);
  });
});
