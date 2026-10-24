import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { prisma } from "@/lib/prisma";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
// Unique simulated client IP so auth rate limits are isolated per suite.
const TEST_IP = "198.51.100.12";

const OWNER_EMAIL = "slice5-test-owner@example.com";
const INTRUDER_EMAIL = "slice5-test-intruder@example.com";
const TEST_PASSWORD = "Slice5-Test-Pass-4400!";
const NOMINEE_EMAIL = "slice5-test-nominee@example.com";
const INVITEE_EMAIL = "slice5-test-invitee@example.com";

type Env = {
  ownerCookie: string;
  ownerUserId: string;
  intruderCookie: string;
  intruderUserId: string;
  created: {
    assetId: string;
    terminalAssetId: string;
    intruderAssetId: string;
    nomineeId: string;
    inviteeNomineeId: string;
    intruderNomineeId: string;
    inviteRequestId: string;
  };
  baseline: {
    demoNominees: number;
    demoRequests: number;
    demoEvents: number;
    demoAuthorizations: number;
    demoNotifications: number;
    demoUsers: number;
  };
};

const env: Env = {
  ownerCookie: "",
  ownerUserId: "",
  intruderCookie: "",
  intruderUserId: "",
  created: {
    assetId: "",
    terminalAssetId: "",
    intruderAssetId: "",
    nomineeId: "",
    inviteeNomineeId: "",
    intruderNomineeId: "",
    inviteRequestId: "",
  },
  baseline: {
    demoNominees: 0,
    demoRequests: 0,
    demoEvents: 0,
    demoAuthorizations: 0,
    demoNotifications: 0,
    demoUsers: 0,
  },
};

function cookieHeader(response: Response): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

async function signUp(email: string, name: string): Promise<{ cookie: string; userId: string }> {
  const response = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, "X-Forwarded-For": TEST_IP },
    body: JSON.stringify({ email, name, password: TEST_PASSWORD }),
  });
  assert.equal(response.status, 200, `sign-up for ${email} returned ${response.status}`);
  // Email verification is enforced: mark this test account verified, then
  // sign in to obtain a session — verified users retain full access.
  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { emailVerified: true },
  });
  const signInResponse = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, "X-Forwarded-For": TEST_IP },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  assert.equal(
    signInResponse.status,
    200,
    `sign-in for ${email} returned ${signInResponse.status}`,
  );
  const cookie = cookieHeader(signInResponse);
  assert.ok(cookie, "expected a session cookie from sign-in");
  const sessionResponse = await fetch(`${BASE}/api/auth/get-session`, {
    headers: { Cookie: cookie, "X-Forwarded-For": TEST_IP },
  });
  const session = (await sessionResponse.json()) as { user?: { id?: string } } | null;
  assert.ok(session?.user?.id, "expected a session user id");
  return { cookie, userId: session.user!.id! };
}

async function api(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function graceDays(): number {
  const parsed = Number(process.env.CLAIM_GRACE_PERIOD_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 3;
}

before(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [OWNER_EMAIL, INTRUDER_EMAIL, NOMINEE_EMAIL, INVITEE_EMAIL] } },
  });

  env.baseline.demoNominees = await prisma.nominee.count({ where: { isDemo: true } });
  env.baseline.demoRequests = await prisma.inheritanceRequest.count({
    where: { isDemo: true },
  });
  env.baseline.demoEvents = await prisma.inheritanceEvent.count({
    where: { request: { isDemo: true } },
  });
  env.baseline.demoAuthorizations = await prisma.assetAuthorization.count({
    where: { isDemo: true },
  });
  env.baseline.demoNotifications = await prisma.notification.count({
    where: { isDemo: true },
  });
  env.baseline.demoUsers = await prisma.user.count({
    where: { email: { endsWith: "@demo.local" } },
  });

  const owner = await signUp(OWNER_EMAIL, "Slice5 Suite Owner");
  env.ownerCookie = owner.cookie;
  env.ownerUserId = owner.userId;

  const intruder = await signUp(INTRUDER_EMAIL, "Slice5 Suite Intruder");
  env.intruderCookie = intruder.cookie;
  env.intruderUserId = intruder.userId;

  const assetCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.ownerCookie,
    body: {
      title: "Suite Nominee Asset",
      category: "CRYPTO",
      providerName: "Test Suite",
      estimatedValue: 100,
      currency: "INR",
    },
  });
  assert.equal(assetCreate.status, 201);
  env.created.assetId = ((await assetCreate.json()) as { id: string }).id;

  const terminalCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.ownerCookie,
    body: {
      title: "Suite Terminal Asset",
      category: "DOMAIN",
      providerName: "Test Suite",
      estimatedValue: 50,
      currency: "INR",
    },
  });
  assert.equal(terminalCreate.status, 201);
  env.created.terminalAssetId = ((await terminalCreate.json()) as { id: string }).id;

  const nomineeCreate = await api("/api/nominees", {
    method: "POST",
    cookie: env.ownerCookie,
    body: {
      name: "Suite Nominee",
      email: NOMINEE_EMAIL,
      relationship: "Sibling",
    },
  });
  assert.equal(nomineeCreate.status, 201);
  env.created.nomineeId = ((await nomineeCreate.json()) as { id: string }).id;

  const inviteeCreate = await api("/api/nominees", {
    method: "POST",
    cookie: env.ownerCookie,
    body: { name: "Registered Invitee", email: INTRUDER_EMAIL },
  });
  assert.equal(inviteeCreate.status, 201);
  env.created.inviteeNomineeId = ((await inviteeCreate.json()) as { id: string }).id;

  const intruderNominee = await api("/api/nominees", {
    method: "POST",
    cookie: env.intruderCookie,
    body: { name: "Intruder Nominee", email: "slice5-test-intruder-nom@example.com" },
  });
  assert.equal(intruderNominee.status, 201);
  env.created.intruderNomineeId = ((await intruderNominee.json()) as { id: string }).id;

  const intruderAsset = await api("/api/assets", {
    method: "POST",
    cookie: env.intruderCookie,
    body: {
      title: "Intruder Suite Asset",
      category: "CRYPTO",
      providerName: "Test Suite",
      estimatedValue: 1,
      currency: "INR",
    },
  });
  assert.equal(intruderAsset.status, 201);
  env.created.intruderAssetId = ((await intruderAsset.json()) as { id: string }).id;

  await prisma.inheritanceRequest.create({
    data: {
      id: randomUUID(),
      assetId: env.created.terminalAssetId,
      nomineeId: env.created.nomineeId,
      invitedById: env.ownerUserId,
      status: "RELEASED",
      invitedAt: new Date("2026-01-01T00:00:00.000Z"),
      graceEndsAt: new Date("2026-01-04T00:00:00.000Z"),
      releasedAt: new Date("2026-01-05T00:00:00.000Z"),
      isDemo: false,
    },
  });

  await prisma.assetAuthorization.create({
    data: {
      id: randomUUID(),
      assetId: env.created.terminalAssetId,
      nomineeId: env.created.nomineeId,
      grantedBy: env.ownerUserId,
      status: "ACTIVE",
      isDemo: false,
    },
  });
});

after(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [OWNER_EMAIL, INTRUDER_EMAIL, NOMINEE_EMAIL, INVITEE_EMAIL] } },
  });
  await prisma.$disconnect();
});

describe("authentication", () => {
  test("unauthenticated nominee requests are rejected with 401", async () => {
    assert.equal((await api("/api/nominees")).status, 401);
    assert.equal(
      (
        await api("/api/nominees", {
          method: "POST",
          body: { name: "X", email: "x@example.com" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api(`/api/nominees/${env.created.nomineeId}`, {
          method: "PATCH",
          body: { name: "X" },
        })
      ).status,
      401,
    );
    assert.equal(
      (await api(`/api/nominees/${env.created.nomineeId}/revoke`, { method: "POST" }))
        .status,
      401,
    );
    assert.equal(
      (
        await api(`/api/assets/${env.created.assetId}/requests`, {
          method: "POST",
          body: { nomineeId: env.created.nomineeId },
        })
      ).status,
      401,
    );
  });
});

describe("creation", () => {
  test("sets owner from the session and ignores client-supplied internal fields", async () => {
    const response = await api("/api/nominees", {
      method: "POST",
      cookie: env.ownerCookie,
      body: {
        name: "Mass Assignment Probe",
        email: "slice5-test-strip@example.com",
        ownerId: env.intruderUserId,
        isDemo: true,
        status: "REVOKED",
      },
    });
    assert.equal(response.status, 201);
    const id = ((await response.json()) as { id: string }).id;

    const nominee = await prisma.nominee.findUnique({ where: { id } });
    assert.ok(nominee);
    assert.equal(nominee.ownerId, env.ownerUserId);
    assert.equal(nominee.isDemo, false);
    assert.equal(nominee.status, "ACTIVE");
    assert.equal(nominee.email, "slice5-test-strip@example.com");
    assert.equal(nominee.revokedAt, null);

    await prisma.nominee.delete({ where: { id } });
  });

  test("normalizes email casing and stores the primary nominee", async () => {
    const response = await api("/api/nominees", {
      method: "POST",
      cookie: env.intruderCookie,
      body: { name: "  Case Probe  ", email: "  Slice5-Test-Case@Example.com " },
    });
    assert.equal(response.status, 201);
    const id = ((await response.json()) as { id: string }).id;

    const nominee = await prisma.nominee.findUnique({ where: { id } });
    assert.ok(nominee);
    assert.equal(nominee.name, "Case Probe");
    assert.equal(nominee.email, "slice5-test-case@example.com");

    await prisma.nominee.delete({ where: { id } });
  });

  test("rejects duplicate active emails with 409 NOMINEE_EXISTS", async () => {
    const response = await api("/api/nominees", {
      method: "POST",
      cookie: env.ownerCookie,
      body: { name: "Duplicate", email: NOMINEE_EMAIL.toUpperCase() },
    });
    assert.equal(response.status, 409);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "NOMINEE_EXISTS");
  });

  test("rejects invalid payloads with field errors and stores nothing", async () => {
    const beforeCount = await prisma.nominee.count({
      where: { ownerId: env.ownerUserId },
    });
    const response = await api("/api/nominees", {
      method: "POST",
      cookie: env.ownerCookie,
      body: { name: "", email: "not-an-email" },
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { fields?: Record<string, string> };
    assert.ok(body.fields?.name);
    assert.ok(body.fields?.email);
    const afterCount = await prisma.nominee.count({
      where: { ownerId: env.ownerUserId },
    });
    assert.equal(afterCount, beforeCount);
  });

  test("rejects unknown-only payloads", async () => {
    const response = await api("/api/nominees", {
      method: "POST",
      cookie: env.ownerCookie,
      body: { ownerId: env.ownerUserId },
    });
    assert.equal(response.status, 400);
  });
});

describe("listing", () => {
  test("shows only the authenticated owner's nominees with request summaries", async () => {
    const invite = await api(`/api/assets/${env.created.assetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(invite.status, 201);
    env.created.inviteRequestId = ((await invite.json()) as { id: string }).id;

    const ownerList = (await (
      await api("/api/nominees", { cookie: env.ownerCookie })
    ).json()) as {
      nominees: Array<{
        id: string;
        email: string;
        status: string;
        requests: Array<{
          id: string;
          assetId: string;
          assetTitle: string;
          status: string;
          graceEndsAt: string;
        }>;
        authorizationCounts: { active: number; revoked: number };
      }>;
    };

    const suiteNominee = ownerList.nominees.find((n) => n.id === env.created.nomineeId);
    assert.ok(suiteNominee, "owner must see their nominee");
    assert.equal(suiteNominee.email, NOMINEE_EMAIL);
    assert.equal(suiteNominee.status, "ACTIVE");

    const inviteRequest = suiteNominee.requests.find(
      (r) => r.id === env.created.inviteRequestId,
    );
    assert.ok(inviteRequest, "list must summarize the created request");
    assert.equal(inviteRequest.assetId, env.created.assetId);
    assert.equal(inviteRequest.assetTitle, "Suite Nominee Asset");
    assert.equal(inviteRequest.status, "INVITED");

    const expectedGrace = Date.now() + graceDays() * 24 * 60 * 60 * 1000;
    const actualGrace = new Date(inviteRequest.graceEndsAt).getTime();
    assert.ok(
      Math.abs(actualGrace - expectedGrace) < 10 * 60 * 1000,
      "graceEndsAt should be approximately now plus the configured grace period",
    );

    assert.equal(
      suiteNominee.authorizationCounts.active,
      1,
      "seeded suite authorization should be counted",
    );

    const intruderList = (await (
      await api("/api/nominees", { cookie: env.intruderCookie })
    ).json()) as { nominees: Array<{ id: string }> };
    assert.ok(
      intruderList.nominees.every((n) => n.id !== env.created.nomineeId),
      "intruder must never see the owner's nominees",
    );
    assert.ok(
      intruderList.nominees.some((n) => n.id === env.created.intruderNomineeId),
      "intruder must see their own nominee",
    );
  });
});

describe("invitations", () => {
  test("creates an INVITED request, an INVITED audit event, and zero authorizations", async () => {
    const response = await api(`/api/assets/${env.created.assetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.inviteeNomineeId },
    });
    assert.equal(response.status, 201);
    const requestId = ((await response.json()) as { id: string }).id;

    const request = await prisma.inheritanceRequest.findUnique({
      where: { id: requestId },
    });
    assert.ok(request);
    assert.equal(request.status, "INVITED");
    assert.equal(request.assetId, env.created.assetId);
    assert.equal(request.nomineeId, env.created.inviteeNomineeId);
    assert.equal(request.invitedById, env.ownerUserId);
    assert.equal(request.isDemo, false);

    const events = await prisma.inheritanceEvent.findMany({
      where: { requestId },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "INVITED");
    assert.equal(events[0].actorId, env.ownerUserId);

    const authsForNominee = await prisma.assetAuthorization.count({
      where: { nomineeId: env.created.inviteeNomineeId },
    });
    assert.equal(authsForNominee, 0, "invitation must never create authorizations");
  });

  test("sends exactly one in-app notification when the nominee email matches a registered user", async () => {
    const intruderUser = await prisma.user.findUnique({
      where: { email: INTRUDER_EMAIL },
      select: { id: true },
    });
    assert.ok(intruderUser);
    const before = await prisma.notification.count({
      where: { userId: intruderUser.id, type: "NOMINEE_INVITE" },
    });

    const response = await api(`/api/assets/${env.created.terminalAssetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.inviteeNomineeId },
    });
    assert.equal(response.status, 201);

    const after = await prisma.notification.count({
      where: { userId: intruderUser.id, type: "NOMINEE_INVITE" },
    });
    assert.equal(after, before + 1);
  });

  test("refuses duplicate invites with 409 REQUEST_EXISTS", async () => {
    const response = await api(`/api/assets/${env.created.assetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(response.status, 409);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "REQUEST_EXISTS");
  });

  test("returns generic 404s for foreign or missing assets and nominees", async () => {
    const foreignAsset = await api(`/api/assets/${env.created.intruderAssetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(foreignAsset.status, 404);
    assert.equal(((await foreignAsset.json()) as { error: string }).error, "Asset not found.");

    const missingAsset = await api(`/api/assets/does-not-exist-123/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(missingAsset.status, 404);
    assert.equal(((await missingAsset.json()) as { error: string }).error, "Asset not found.");

    const foreignNominee = await api(`/api/assets/${env.created.intruderAssetId}/requests`, {
      method: "POST",
      cookie: env.intruderCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(foreignNominee.status, 404);
    assert.equal(
      ((await foreignNominee.json()) as { error: string }).error,
      "Nominee not found.",
    );

    const missingNominee = await api(`/api/assets/${env.created.intruderAssetId}/requests`, {
      method: "POST",
      cookie: env.intruderCookie,
      body: { nomineeId: "does-not-exist-123" },
    });
    assert.equal(missingNominee.status, 404);
    assert.equal(
      ((await missingNominee.json()) as { error: string }).error,
      "Nominee not found.",
    );
  });
});

describe("revocation and restoration", () => {
  test("revocation transitions open requests, revokes authorizations, keeps records and appends events", async () => {
    const openRequestEventsBefore = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.inviteRequestId },
    });

    const response = await api(`/api/nominees/${env.created.nomineeId}/revoke`, {
      method: "POST",
      cookie: env.ownerCookie,
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      alreadyRevoked: boolean;
      revokedRequests: number;
      revokedAuthorizations: number;
    };
    assert.equal(body.alreadyRevoked, false);
    assert.equal(body.revokedRequests, 1, "only the open request is transitioned");
    assert.equal(body.revokedAuthorizations, 1, "the active authorization is revoked");

    const nominee = await prisma.nominee.findUnique({
      where: { id: env.created.nomineeId },
    });
    assert.ok(nominee);
    assert.equal(nominee.status, "REVOKED");
    assert.ok(nominee.revokedAt, "revokedAt must be recorded");

    const openRequest = await prisma.inheritanceRequest.findUnique({
      where: { id: env.created.inviteRequestId },
    });
    assert.equal(openRequest?.status, "REVOKED");

    const releasedRequest = await prisma.inheritanceRequest.findFirst({
      where: {
        assetId: env.created.terminalAssetId,
        nomineeId: env.created.nomineeId,
      },
    });
    assert.ok(releasedRequest, "terminal request row must never be deleted");
    assert.equal(
      releasedRequest.status,
      "RELEASED",
      "terminal statuses must not be transitioned by revocation",
    );

    const authorization = await prisma.assetAuthorization.findFirst({
      where: {
        assetId: env.created.terminalAssetId,
        nomineeId: env.created.nomineeId,
        attempt: 1,
      },
    });
    assert.ok(authorization);
    assert.equal(authorization.status, "REVOKED");
    assert.ok(authorization.revokedAt);

    const openRequestEventsAfter = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.inviteRequestId },
    });
    assert.equal(
      openRequestEventsAfter,
      openRequestEventsBefore + 1,
      "exactly one REVOKED audit event is appended",
    );

    const untouchedInvite = await prisma.inheritanceRequest.findFirst({
      where: { nomineeId: env.created.inviteeNomineeId, status: "INVITED" },
    });
    assert.ok(untouchedInvite, "other nominees' open requests must stay INVITED");
  });

  test("repeat revocation is idempotent and adds no duplicate events", async () => {
    const eventsBefore = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.inviteRequestId },
    });

    const response = await api(`/api/nominees/${env.created.nomineeId}/revoke`, {
      method: "POST",
      cookie: env.ownerCookie,
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      alreadyRevoked: boolean;
      revokedRequests: number;
      revokedAuthorizations: number;
    };
    assert.equal(body.alreadyRevoked, true);
    assert.equal(body.revokedRequests, 0);
    assert.equal(body.revokedAuthorizations, 0);

    const eventsAfter = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.inviteRequestId },
    });
    assert.equal(eventsAfter, eventsBefore);
  });

  test("revoked nominees reject re-adds and new invitations", async () => {
    const duplicate = await api("/api/nominees", {
      method: "POST",
      cookie: env.ownerCookie,
      body: { name: "Again", email: NOMINEE_EMAIL },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(((await duplicate.json()) as { code?: string }).code, "NOMINEE_REVOKED");

    const invite = await api(`/api/assets/${env.created.intruderAssetId}/requests`, {
      method: "POST",
      cookie: env.intruderCookie,
      body: { nomineeId: env.created.intruderNomineeId },
    });
    assert.equal(invite.status, 201);

    const inviteRevoked = await api(`/api/assets/${env.created.assetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(inviteRevoked.status, 409);
    assert.equal(
      ((await inviteRevoked.json()) as { code?: string }).code,
      "NOMINEE_REVOKED",
    );
  });

  test("restore flips the nominee to ACTIVE but never reactivates prior access", async () => {
    const response = await api(`/api/nominees/${env.created.nomineeId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: { status: "ACTIVE" },
    });
    assert.equal(response.status, 200);

    const nominee = await prisma.nominee.findUnique({
      where: { id: env.created.nomineeId },
    });
    assert.equal(nominee?.status, "ACTIVE");
    assert.equal(nominee?.revokedAt, null);

    const request = await prisma.inheritanceRequest.findUnique({
      where: { id: env.created.inviteRequestId },
    });
    assert.equal(request?.status, "REVOKED", "restored nominee keeps revoked requests");

    const authorization = await prisma.assetAuthorization.findFirst({
      where: {
        assetId: env.created.terminalAssetId,
        nomineeId: env.created.nomineeId,
        attempt: 1,
      },
      orderBy: { grantedAt: "desc" },
    });
    assert.equal(authorization?.status, "REVOKED", "restored nominee keeps revoked authorizations");
  });
});

describe("update immutability and isolation", () => {
  test("rejects email changes and direct status REVOKED", async () => {
    const emailChange = await api(`/api/nominees/${env.created.nomineeId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: { email: "changed@example.com" },
    });
    assert.equal(emailChange.status, 400);
    const body = (await emailChange.json()) as { fields?: Record<string, string> };
    assert.ok(body.fields?.email);

    const statusChange = await api(`/api/nominees/${env.created.nomineeId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: { status: "REVOKED" },
    });
    assert.equal(statusChange.status, 400);

    const empty = await api(`/api/nominees/${env.created.nomineeId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: {},
    });
    assert.equal(empty.status, 400);
  });

  test("rename works and strips client-supplied ownership fields", async () => {
    const response = await api(`/api/nominees/${env.created.nomineeId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: {
        name: "Suite Nominee Renamed",
        relationship: "",
        ownerId: env.intruderUserId,
        isDemo: true,
      },
    });
    assert.equal(response.status, 200);

    const nominee = await prisma.nominee.findUnique({
      where: { id: env.created.nomineeId },
    });
    assert.equal(nominee?.name, "Suite Nominee Renamed");
    assert.equal(nominee?.relationship, null);
    assert.equal(nominee?.ownerId, env.ownerUserId);
    assert.equal(nominee?.isDemo, false);
  });

  test("cross-owner reads, updates, revokes and invites all fail with generic 404s", async () => {
    const patch = await api(`/api/nominees/${env.created.nomineeId}`, {
      method: "PATCH",
      cookie: env.intruderCookie,
      body: { name: "Hijacked" },
    });
    assert.equal(patch.status, 404);
    assert.equal(((await patch.json()) as { error: string }).error, "Nominee not found.");

    const missing = await api(`/api/nominees/some-missing-nominee-id`, {
      method: "PATCH",
      cookie: env.intruderCookie,
      body: { name: "Hijacked" },
    });
    assert.equal(missing.status, 404);
    assert.equal(((await missing.json()) as { error: string }).error, "Nominee not found.");

    const revoke = await api(`/api/nominees/${env.created.nomineeId}/revoke`, {
      method: "POST",
      cookie: env.intruderCookie,
    });
    assert.equal(revoke.status, 404);
  });

  test("an invited registered user gains no asset access from the invitation", async () => {
    const read = await api(`/api/assets/${env.created.assetId}`, {
      cookie: env.intruderCookie,
    });
    assert.equal(read.status, 404, "invited user must not read the asset");

    const list = (await (
      await api("/api/assets", { cookie: env.intruderCookie })
    ).json()) as { assets: Array<{ id: string }> };
    assert.ok(
      list.assets.every((asset) => asset.id !== env.created.assetId),
      "invited asset must not appear in the invitee's asset list",
    );
  });
});

describe("demo and seed integrity", () => {
  test("demo rows and authorization history remain untouched", async () => {
    const demoNominees = await prisma.nominee.findMany({
      where: { isDemo: true },
      orderBy: { id: "asc" },
    });
    assert.equal(demoNominees.length, env.baseline.demoNominees);
    for (const nominee of demoNominees) {
      assert.equal(nominee.status, "ACTIVE");
      assert.equal(nominee.revokedAt, null);
    }

    const demoRequests = await prisma.inheritanceRequest.count({
      where: { isDemo: true },
    });
    assert.equal(demoRequests, env.baseline.demoRequests);

    const demoEvents = await prisma.inheritanceEvent.count({
      where: { request: { isDemo: true } },
    });
    assert.equal(demoEvents, env.baseline.demoEvents);

    const demoAuths = await prisma.assetAuthorization.findMany({
      where: { isDemo: true },
      orderBy: { id: "asc" },
    });
    assert.equal(demoAuths.length, env.baseline.demoAuthorizations);
    for (const authorization of demoAuths) {
      if (authorization.status === "REVOKED") {
        assert.ok(
          authorization.revokedAt,
          "seeded revoked authorization history keeps its revokedAt",
        );
      }
    }

    const demoNotifications = await prisma.notification.count({
      where: { isDemo: true },
    });
    assert.equal(demoNotifications, env.baseline.demoNotifications);
  });
});

describe("cleanup guarantees", () => {
  test("test users own no leftover rows after cleanup", async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [OWNER_EMAIL, INTRUDER_EMAIL, NOMINEE_EMAIL, INVITEE_EMAIL] } },
    });

    const leftoverUsers = await prisma.user.count({
      where: { email: { in: [OWNER_EMAIL, INTRUDER_EMAIL, NOMINEE_EMAIL, INVITEE_EMAIL] } },
    });
    assert.equal(leftoverUsers, 0);

    const leftoverNominees = await prisma.nominee.count({
      where: { ownerId: { in: [env.ownerUserId, env.intruderUserId] } },
    });
    assert.equal(leftoverNominees, 0, "nominee rows cascade with their users");

    const leftoverAssets = await prisma.asset.count({
      where: { ownerId: { in: [env.ownerUserId, env.intruderUserId] } },
    });
    assert.equal(leftoverAssets, 0, "asset rows cascade with their users");

    const leftoverRequests = await prisma.inheritanceRequest.count({
      where: { asset: { ownerId: { in: [env.ownerUserId, env.intruderUserId] } } },
    });
    assert.equal(leftoverRequests, 0, "requests cascade with their assets");

    const demoUsers = await prisma.user.count({
      where: { email: { endsWith: "@demo.local" } },
    });
    assert.equal(demoUsers, env.baseline.demoUsers);
  });
});
