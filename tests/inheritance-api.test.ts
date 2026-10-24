import "dotenv/config";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { prisma } from "@/lib/prisma";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
// Unique simulated client IP so auth rate limits are isolated per suite.
const TEST_IP = "198.51.100.13";

const OWNER_EMAIL = "slice5b-api-owner@example.com";
const INTRUDER_EMAIL = "slice5b-api-intruder@example.com";
const NOMINEE_EMAIL = "slice5b-api-nominee@example.com";
const OTHER_NOMINEE_EMAIL = "slice5b-api-nominee2@example.com";
const TEST_PASSWORD = "Slice5B-Api-Pass-7700!";

type Env = {
  ownerCookie: string;
  ownerUserId: string;
  intruderCookie: string;
  nomineeCookie: string;
  nomineeUserId: string;
  otherNomineeCookie: string;
  created: {
    flowAssetId: string;
    rejectAssetId: string;
    declineAssetId: string;
    expireAssetId: string;
    nomineeId: string;
    otherNomineeId: string;
    flowRequestId: string;
    flowClaimCode: string;
    flowAuthorizationId: string;
    rejectRequestId: string;
    rejectClaimCode: string;
    declineRequestId: string;
    declineClaimCode: string;
    expireRequestId: string;
    expireClaimCode: string;
    attemptRequestId: string;
    attemptClaimCode: string;
    concurrentRequestId: string;
    concurrentClaimCode: string;
  };
  baseline: {
    demoRequests: number;
    demoEvents: number;
    demoAuthorizations: number;
    demoNotifications: number;
  };
};

const env: Env = {
  ownerCookie: "",
  ownerUserId: "",
  intruderCookie: "",
  nomineeCookie: "",
  nomineeUserId: "",
  otherNomineeCookie: "",
  created: {
    flowAssetId: "",
    rejectAssetId: "",
    declineAssetId: "",
    expireAssetId: "",
    nomineeId: "",
    otherNomineeId: "",
    flowRequestId: "",
    flowClaimCode: "",
    flowAuthorizationId: "",
    rejectRequestId: "",
    rejectClaimCode: "",
    declineRequestId: "",
    declineClaimCode: "",
    expireRequestId: "",
    expireClaimCode: "",
    attemptRequestId: "",
    attemptClaimCode: "",
    concurrentRequestId: "",
    concurrentClaimCode: "",
  },
  baseline: { demoRequests: 0, demoEvents: 0, demoAuthorizations: 0, demoNotifications: 0 },
};

function cookieHeader(response: Response): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

async function signUp(
  email: string,
  name: string,
): Promise<{ cookie: string; userId: string }> {
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

async function createAsset(cookie: string, title: string): Promise<string> {
  const response = await api("/api/assets", {
    method: "POST",
    cookie,
    body: {
      title,
      category: "CRYPTO",
      providerName: "Slice5B Suite",
      estimatedValue: 250,
      currency: "INR",
      accountReference: "slice5b-ref",
    },
  });
  assert.equal(response.status, 201);
  return ((await response.json()) as { id: string }).id;
}

async function invite(
  cookie: string,
  assetId: string,
  nomineeId: string,
): Promise<{ id: string; claimCode: string }> {
  const response = await api(`/api/assets/${assetId}/requests`, {
    method: "POST",
    cookie,
    body: { nomineeId },
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string; claimCode: string };
}

before(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [OWNER_EMAIL, INTRUDER_EMAIL, NOMINEE_EMAIL, OTHER_NOMINEE_EMAIL],
      },
    },
  });

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

  const owner = await signUp(OWNER_EMAIL, "Slice5B API Owner");
  env.ownerCookie = owner.cookie;
  env.ownerUserId = owner.userId;

  const intruder = await signUp(INTRUDER_EMAIL, "Slice5B API Intruder");
  env.intruderCookie = intruder.cookie;

  const nominee = await signUp(NOMINEE_EMAIL, "Slice5B API Nominee");
  env.nomineeCookie = nominee.cookie;
  env.nomineeUserId = nominee.userId;

  const other = await signUp(OTHER_NOMINEE_EMAIL, "Slice5B API Other Nominee");
  env.otherNomineeCookie = other.cookie;

  env.created.flowAssetId = await createAsset(env.ownerCookie, "Slice5B Flow Asset");
  env.created.rejectAssetId = await createAsset(env.ownerCookie, "Slice5B Reject Asset");
  env.created.declineAssetId = await createAsset(env.ownerCookie, "Slice5B Decline Asset");
  env.created.expireAssetId = await createAsset(env.ownerCookie, "Slice5B Expire Asset");

  const nomineeCreate = await api("/api/nominees", {
    method: "POST",
    cookie: env.ownerCookie,
    body: { name: "Slice5B API Nominee", email: NOMINEE_EMAIL, relationship: "test" },
  });
  assert.equal(nomineeCreate.status, 201);
  env.created.nomineeId = ((await nomineeCreate.json()) as { id: string }).id;

  const otherCreate = await api("/api/nominees", {
    method: "POST",
    cookie: env.ownerCookie,
    body: { name: "Slice5B API Other", email: OTHER_NOMINEE_EMAIL },
  });
  assert.equal(otherCreate.status, 201);
  env.created.otherNomineeId = ((await otherCreate.json()) as { id: string }).id;
});

after(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [OWNER_EMAIL, INTRUDER_EMAIL, NOMINEE_EMAIL, OTHER_NOMINEE_EMAIL],
      },
    },
  });
  await prisma.$disconnect();
});

describe("authentication", () => {
  test("all claim-workflow endpoints reject unauthenticated requests with 401", async () => {
    assert.equal((await api("/api/me/inheritance")).status, 401);
    assert.equal(
      (await api("/api/me/inheritance/x/claim", { method: "POST", body: { attestation: true } })).status,
      401,
    );
    assert.equal(
      (
        await api("/api/me/inheritance/x/submit-claim", {
          method: "POST",
          body: { attestation: true },
        })
      ).status,
      401,
    );
    assert.equal(
      (await api("/api/me/inheritance/x/decline", { method: "POST", body: {} })).status,
      401,
    );
    assert.equal((await api("/api/me/assets/x")).status, 401);
    assert.equal((await api("/api/inheritance/x/approve", { method: "POST" })).status, 401);
    assert.equal(
      (await api("/api/inheritance/x/reject", { method: "POST", body: {} })).status,
      401,
    );
    assert.equal(
      (await api("/api/authorizations/x/revoke", { method: "POST" })).status,
      401,
    );
  });
});

describe("invite and claim-code lifecycle", () => {
  test("inviting returns a one-time claim code; only a hash is stored", async () => {
    const result = await invite(
      env.ownerCookie,
      env.created.flowAssetId,
      env.created.nomineeId,
    );
    env.created.flowRequestId = result.id;
    env.created.flowClaimCode = result.claimCode;

    assert.ok(result.claimCode.length >= 16);
    const row = await prisma.inheritanceRequest.findUnique({
      where: { id: result.id },
    });
    assert.ok(row);
    assert.equal(row.status, "INVITED");
    assert.equal(row.attempt, 1);
    assert.equal(row.claimCodeAttempts, 0);
    assert.ok(row.claimCodeHash);
    assert.ok(!row.claimCodeHash.includes(result.claimCode));

    const inviteNotification = await prisma.notification.findFirst({
      where: { userId: env.nomineeUserId, type: "NOMINEE_INVITE" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(inviteNotification, "invite must notify the nominee account");
  });

  test("duplicate invites for an open request are rejected with 409", async () => {
    const response = await api(`/api/assets/${env.created.flowAssetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(response.status, 409);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "REQUEST_EXISTS");
  });

  test("nominee list is scoped and reports the claim-code requirement", async () => {
    const response = await api("/api/me/inheritance", { cookie: env.nomineeCookie });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { items: Array<Record<string, unknown>> };
    const mine = body.items.filter((item) => item.id === env.created.flowRequestId);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].claimCodeRequired, true);
    assert.equal(mine[0].canClaim, true);

    const ownerList = await api("/api/me/inheritance", { cookie: env.ownerCookie });
    const ownerBody = (await ownerList.json()) as { items: unknown[] };
    assert.equal(ownerBody.items.length, 0);
  });

  test("wrong claim code fails without creating events", async () => {
    const before = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.flowRequestId },
    });
    const response = await api(`/api/me/inheritance/${env.created.flowRequestId}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true, claimCode: "definitely-wrong-code" },
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "CLAIM_CODE_INVALID");

    const row = await prisma.inheritanceRequest.findUnique({
      where: { id: env.created.flowRequestId },
    });
    assert.equal(row?.claimCodeAttempts, 1);
    const afterCount = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.flowRequestId },
    });
    assert.equal(afterCount, before, "failed claims must not create events");
  });

  test("missing claim code is rejected with CLAIM_CODE_REQUIRED", async () => {
    const response = await api(`/api/me/inheritance/${env.created.flowRequestId}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "CLAIM_CODE_REQUIRED");
  });

  test("correct claim code initiates the claim and consumes the code", async () => {
    const response = await api(`/api/me/inheritance/${env.created.flowRequestId}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true, claimCode: env.created.flowClaimCode },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { status?: string };
    assert.equal(body.status, "ELIGIBLE");

    const row = await prisma.inheritanceRequest.findUnique({
      where: { id: env.created.flowRequestId },
    });
    assert.equal(row?.status, "ELIGIBLE");
    assert.equal(row?.claimCodeHash, null, "consumed claim code must be cleared");

    const events = await prisma.inheritanceEvent.findMany({
      where: { requestId: env.created.flowRequestId, action: "ELIGIBILITY_MET" },
    });
    assert.equal(events.length, 1);
  });

  test("repeating initiate-claim is rejected with 409 and adds no events", async () => {
    const before = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.flowRequestId },
    });
    const response = await api(`/api/me/inheritance/${env.created.flowRequestId}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });
    assert.equal(response.status, 409);
    const afterCount = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.flowRequestId },
    });
    assert.equal(afterCount, before);
  });

  test("submitting the claim records reconfirmation events", async () => {
    const response = await api(
      `/api/me/inheritance/${env.created.flowRequestId}/submit-claim`,
      {
        method: "POST",
        cookie: env.nomineeCookie,
        body: { attestation: true },
      },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { status?: string };
    assert.equal(body.status, "CLAIMED_PENDING_CONFIRM");

    const started = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.flowRequestId, action: "CLAIM_STARTED" },
    });
    const reconfirmed = await prisma.inheritanceEvent.count({
      where: {
        requestId: env.created.flowRequestId,
        action: "IDENTITY_RECONFIRMED",
      },
    });
    assert.equal(started, 1);
    assert.equal(reconfirmed, 1);
  });

  test("repeating submit-claim is rejected with 409", async () => {
    const response = await api(
      `/api/me/inheritance/${env.created.flowRequestId}/submit-claim`,
      {
        method: "POST",
        cookie: env.nomineeCookie,
        body: { attestation: true },
      },
    );
    assert.equal(response.status, 409);
  });
});

describe("owner approval, whitelist and authorization revocation", () => {
  test("nominee and foreign owners cannot approve the claim", async () => {
    assert.equal(
      (
        await api(`/api/inheritance/${env.created.flowRequestId}/approve`, {
          method: "POST",
          cookie: env.nomineeCookie,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await api(`/api/inheritance/${env.created.flowRequestId}/approve`, {
          method: "POST",
          cookie: env.intruderCookie,
        })
      ).status,
      404,
    );
  });

  test("owner approval releases guidance-only access and notifies the nominee", async () => {
    const response = await api(`/api/inheritance/${env.created.flowRequestId}/approve`, {
      method: "POST",
      cookie: env.ownerCookie,
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { authorizationId?: string };
    assert.ok(body.authorizationId);
    env.created.flowAuthorizationId = body.authorizationId!;

    const request = await prisma.inheritanceRequest.findUnique({
      where: { id: env.created.flowRequestId },
    });
    assert.equal(request?.status, "RELEASED");
    assert.ok(request?.releasedAt);

    const authorization = await prisma.assetAuthorization.findUnique({
      where: { id: env.created.flowAuthorizationId },
    });
    assert.equal(authorization?.status, "ACTIVE");
    assert.equal(authorization?.grantedBy, env.ownerUserId);
    assert.equal(authorization?.attempt, 1);

    const releasedEvent = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.flowRequestId, action: "RELEASED" },
    });
    assert.equal(releasedEvent, 1);

    const notification = await prisma.notification.findFirst({
      where: { userId: env.nomineeUserId, type: "ACCESS_RELEASED" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(notification, "approval must create an ACCESS_RELEASED notification");
  });

  test("repeating approval is rejected and creates no second authorization", async () => {
    const response = await api(`/api/inheritance/${env.created.flowRequestId}/approve`, {
      method: "POST",
      cookie: env.ownerCookie,
    });
    assert.equal(response.status, 409);
    const count = await prisma.assetAuthorization.count({
      where: {
        assetId: env.created.flowAssetId,
        nomineeId: env.created.nomineeId,
        status: "ACTIVE",
      },
    });
    assert.equal(count, 1);
  });

  test("released recovery view enforces the strict whitelist and D4 flag", async () => {
    const response = await api(`/api/me/assets/${env.created.flowAssetId}`, {
      cookie: env.nomineeCookie,
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      asset: Record<string, unknown>;
      authorizationId: string;
    };
    assert.equal(body.authorizationId, env.created.flowAuthorizationId);
    const keys = Object.keys(body.asset);
    for (const forbidden of [
      "estimatedValue",
      "currency",
      "valuationBasis",
      "resaleNotes",
      "description",
      "ownerId",
    ]) {
      assert.ok(!keys.includes(forbidden), `${forbidden} must never be exposed`);
    }
    assert.equal(body.asset.accountReference, null, "D4 default hides the reference");

    await api(`/api/assets/${env.created.flowAssetId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: { nomineeCanSeeAccountReference: true },
    });
    const after = await api(`/api/me/assets/${env.created.flowAssetId}`, {
      cookie: env.nomineeCookie,
    });
    const afterBody = (await after.json()) as { asset: Record<string, unknown> };
    assert.equal(afterBody.asset.accountReference, "slice5b-ref");
  });

  test("foreign nominees get 404 for the released view", async () => {
    const response = await api(`/api/me/assets/${env.created.flowAssetId}`, {
      cookie: env.otherNomineeCookie,
    });
    assert.equal(response.status, 404);
  });

  test("owner revokes the authorization; access ends; revoke is idempotent", async () => {
    const foreign = await api(
      `/api/authorizations/${env.created.flowAuthorizationId}/revoke`,
      { method: "POST", cookie: env.intruderCookie },
    );
    assert.equal(foreign.status, 404);

    const nomineeAttempt = await api(
      `/api/authorizations/${env.created.flowAuthorizationId}/revoke`,
      { method: "POST", cookie: env.nomineeCookie },
    );
    assert.equal(nomineeAttempt.status, 404);

    const response = await api(
      `/api/authorizations/${env.created.flowAuthorizationId}/revoke`,
      { method: "POST", cookie: env.ownerCookie },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { alreadyRevoked?: boolean };
    assert.equal(body.alreadyRevoked, false);

    const authorization = await prisma.assetAuthorization.findUnique({
      where: { id: env.created.flowAuthorizationId },
    });
    assert.equal(authorization?.status, "REVOKED");
    assert.ok(authorization?.revokedAt);

    const changed = await prisma.notification.findFirst({
      where: { userId: env.nomineeUserId, type: "AUTHORIZATION_CHANGED" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(changed);

    const view = await api(`/api/me/assets/${env.created.flowAssetId}`, {
      cookie: env.nomineeCookie,
    });
    assert.equal(view.status, 404, "revoked authorization must end access");

    const again = await api(
      `/api/authorizations/${env.created.flowAuthorizationId}/revoke`,
      { method: "POST", cookie: env.ownerCookie },
    );
    assert.equal(again.status, 200);
    const againBody = (await again.json()) as { alreadyRevoked?: boolean };
    assert.equal(againBody.alreadyRevoked, true);

    const releasedEvent = await prisma.inheritanceEvent.count({
      where: { requestId: env.created.flowRequestId, action: "REVOKED" },
    });
    assert.equal(releasedEvent, 1, "revocation must record exactly one event");
  });
});

describe("rejection, decline and re-invitation attempts", () => {
  test("owner can reject a pending claim with a reason", async () => {
    const first = await invite(
      env.ownerCookie,
      env.created.rejectAssetId,
      env.created.nomineeId,
    );
    env.created.rejectRequestId = first.id;
    env.created.rejectClaimCode = first.claimCode;

    await api(`/api/me/inheritance/${first.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true, claimCode: first.claimCode },
    });
    await api(`/api/me/inheritance/${first.id}/submit-claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });

    const response = await api(`/api/inheritance/${first.id}/reject`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { reason: "Still in control of this account." },
    });
    assert.equal(response.status, 200);

    const row = await prisma.inheritanceRequest.findUnique({ where: { id: first.id } });
    assert.equal(row?.status, "DECLINED");
    assert.equal(row?.declineReason, "Still in control of this account.");

    const authCount = await prisma.assetAuthorization.count({
      where: { assetId: env.created.rejectAssetId },
    });
    assert.equal(authCount, 0, "rejection must never create authorizations");
  });

  test("nominee can decline an open request with an optional reason", async () => {
    const first = await invite(
      env.ownerCookie,
      env.created.declineAssetId,
      env.created.nomineeId,
    );
    env.created.declineRequestId = first.id;
    env.created.declineClaimCode = first.claimCode;

    const response = await api(`/api/me/inheritance/${first.id}/decline`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { reason: "Not the right person to handle this." },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { status?: string };
    assert.equal(body.status, "DECLINED");

    const again = await api(`/api/me/inheritance/${first.id}/decline`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: {},
    });
    assert.equal(again.status, 409, "terminal requests cannot be declined again");
  });

  test("decline remains available from open states even when the nominee row is revoked", async () => {
    const second = await invite(
      env.ownerCookie,
      env.created.declineAssetId,
      env.created.nomineeId,
    );
    env.created.attemptRequestId = second.id;
    env.created.attemptClaimCode = second.claimCode;

    await prisma.nominee.update({
      where: { id: env.created.nomineeId },
      data: { status: "REVOKED" },
    });

    const response = await api(`/api/me/inheritance/${second.id}/decline`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: {},
    });
    assert.equal(response.status, 200, "D5: open requests stay declinable");

    await prisma.nominee.update({
      where: { id: env.created.nomineeId },
      data: { status: "ACTIVE" },
    });
  });

  test("re-invitation increments the attempt counter and returns a fresh code", async () => {
    const before = await prisma.inheritanceRequest.findFirst({
      where: {
        assetId: env.created.declineAssetId,
        nomineeId: env.created.nomineeId,
      },
      orderBy: { attempt: "desc" },
    });
    assert.equal(before?.attempt, 2);

    const third = await invite(
      env.ownerCookie,
      env.created.declineAssetId,
      env.created.nomineeId,
    );
    env.created.attemptRequestId = third.id;
    env.created.attemptClaimCode = third.claimCode;
    assert.notEqual(third.claimCode, env.created.declineClaimCode);

    const row = await prisma.inheritanceRequest.findUnique({ where: { id: third.id } });
    assert.equal(row?.attempt, 3);
  });

  test("claim-code attempts lock after five failures", async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await api(
        `/api/me/inheritance/${env.created.attemptRequestId}/claim`,
        {
          method: "POST",
          cookie: env.nomineeCookie,
          body: { attestation: true, claimCode: `bad-code-${i}` },
        },
      );
      assert.equal(response.status, 400);
    }

    const locked = await api(
      `/api/me/inheritance/${env.created.attemptRequestId}/claim`,
      {
        method: "POST",
        cookie: env.nomineeCookie,
        body: { attestation: true, claimCode: env.created.attemptClaimCode },
      },
    );
    assert.equal(locked.status, 409);
    const body = (await locked.json()) as { code?: string };
    assert.equal(body.code, "CLAIM_CODE_LOCKED");

    const row = await prisma.inheritanceRequest.findUnique({
      where: { id: env.created.attemptRequestId },
    });
    assert.equal(row?.claimCodeAttempts, 5);
    assert.equal(row?.status, "INVITED", "locking must not change the status");
  });

  test("re-invite while a request is still open is refused with 409", async () => {
    const response = await api(`/api/assets/${env.created.declineAssetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.created.nomineeId },
    });
    assert.equal(response.status, 409);
  });
});

describe("lazy expiry and concurrent duplicate transitions", () => {
  test("claiming after the grace window lazily expires the request exactly once", async () => {
    const row = await prisma.inheritanceRequest.create({
      data: {
        id: crypto.randomUUID(),
        assetId: env.created.expireAssetId,
        nomineeId: env.created.nomineeId,
        invitedById: env.ownerUserId,
        attempt: 1,
        status: "INVITED",
        invitedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        graceEndsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        claimCodeHash: null,
        isDemo: false,
      },
    });
    env.created.expireRequestId = row.id;

    const response = await api(`/api/me/inheritance/${row.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });
    assert.equal(response.status, 409);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "EXPIRED");

    const expiredRow = await prisma.inheritanceRequest.findUnique({
      where: { id: row.id },
    });
    assert.equal(expiredRow?.status, "EXPIRED");

    const expiredEvents = await prisma.inheritanceEvent.count({
      where: { requestId: row.id, action: "EXPIRED" },
    });
    assert.equal(expiredEvents, 1, "expiry must record exactly one event");

    const again = await api(`/api/me/inheritance/${row.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });
    assert.equal(again.status, 409);
    const expiredAgain = await prisma.inheritanceEvent.count({
      where: { requestId: row.id, action: "EXPIRED" },
    });
    assert.equal(expiredAgain, 1, "re-claims must not add more expiry events");
  });

  test("concurrent duplicate claims produce a single transition", async () => {
    const pair = await invite(
      env.ownerCookie,
      env.created.expireAssetId,
      env.created.otherNomineeId,
    );
    env.created.concurrentRequestId = pair.id;
    env.created.concurrentClaimCode = pair.claimCode;

    const [a, b] = await Promise.all([
      api(`/api/me/inheritance/${pair.id}/claim`, {
        method: "POST",
        cookie: env.otherNomineeCookie,
        body: { attestation: true, claimCode: pair.claimCode },
      }),
      api(`/api/me/inheritance/${pair.id}/claim`, {
        method: "POST",
        cookie: env.otherNomineeCookie,
        body: { attestation: true, claimCode: pair.claimCode },
      }),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const row = await prisma.inheritanceRequest.findUnique({ where: { id: pair.id } });
    assert.equal(row?.status, "ELIGIBLE");
    const events = await prisma.inheritanceEvent.count({
      where: { requestId: pair.id, action: "ELIGIBILITY_MET" },
    });
    assert.equal(events, 1);
  });

  test("concurrent duplicate approvals produce a single authorization", async () => {
    await api(`/api/me/inheritance/${env.created.concurrentRequestId}/submit-claim`, {
      method: "POST",
      cookie: env.otherNomineeCookie,
      body: { attestation: true },
    });

    const [a, b] = await Promise.all([
      api(`/api/inheritance/${env.created.concurrentRequestId}/approve`, {
        method: "POST",
        cookie: env.ownerCookie,
      }),
      api(`/api/inheritance/${env.created.concurrentRequestId}/approve`, {
        method: "POST",
        cookie: env.ownerCookie,
      }),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const authorizations = await prisma.assetAuthorization.findMany({
      where: {
        assetId: env.created.expireAssetId,
        nomineeId: env.created.otherNomineeId,
        attempt: 1,
      },
    });
    assert.equal(authorizations.length, 1);
    assert.equal(authorizations[0].status, "ACTIVE");
  });
});

describe("seed regression: approval over revoked authorization history", () => {
  test("concurrent approvals succeed where a REVOKED authorization already occupies the attempt; history is preserved", async () => {
    const assetId = await createAsset(env.ownerCookie, "Slice5B Seed-Shape Asset");
    const requestId = crypto.randomUUID();
    const revokedAuthId = crypto.randomUUID();
    const now = new Date();

    await prisma.inheritanceRequest.create({
      data: {
        id: requestId,
        assetId,
        nomineeId: env.created.nomineeId,
        invitedById: env.ownerUserId,
        attempt: 1,
        status: "CLAIMED_PENDING_CONFIRM",
        invitedAt: now,
        graceEndsAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        claimedAt: now,
        claimCodeHash: null,
        isDemo: false,
      },
    });
    await prisma.assetAuthorization.create({
      data: {
        id: revokedAuthId,
        assetId,
        nomineeId: env.created.nomineeId,
        grantedBy: env.ownerUserId,
        attempt: 1,
        status: "REVOKED",
        revokedAt: now,
        isDemo: false,
      },
    });

    const [first, second] = await Promise.all([
      api(`/api/inheritance/${requestId}/approve`, {
        method: "POST",
        cookie: env.ownerCookie,
      }),
      api(`/api/inheritance/${requestId}/approve`, {
        method: "POST",
        cookie: env.ownerCookie,
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    const winner = first.status === 200 ? first : second;
    const winnerBody = (await winner.json()) as { authorizationId?: string };
    assert.ok(winnerBody.authorizationId);
    const newAuthId = winnerBody.authorizationId!;
    assert.notEqual(newAuthId, revokedAuthId);

    const request = await prisma.inheritanceRequest.findUnique({
      where: { id: requestId },
    });
    assert.equal(request?.status, "RELEASED");

    const oldRow = await prisma.assetAuthorization.findUnique({
      where: { id: revokedAuthId },
    });
    assert.equal(oldRow?.status, "REVOKED", "historical revoked row must never be reactivated");
    assert.ok(oldRow?.revokedAt, "historical revokedAt must remain intact");

    const newRow = await prisma.assetAuthorization.findUnique({
      where: { id: newAuthId },
    });
    assert.equal(newRow?.status, "ACTIVE");
    assert.equal(newRow?.grantedBy, env.ownerUserId);
    assert.equal(newRow?.attempt, 1);
    assert.equal(newRow?.revokedAt, null);

    const pairRows = await prisma.assetAuthorization.findMany({
      where: { assetId, nomineeId: env.created.nomineeId, attempt: 1 },
    });
    assert.equal(pairRows.length, 2, "one ACTIVE grant plus one REVOKED historical row");
    assert.equal(pairRows.filter((row) => row.status === "ACTIVE").length, 1);

    const releaseEvents = await prisma.inheritanceEvent.count({
      where: { requestId, action: "RELEASED" },
    });
    assert.equal(releaseEvents, 1, "only the winning approval commits its event");

    const repeat = await api(`/api/inheritance/${requestId}/approve`, {
      method: "POST",
      cookie: env.ownerCookie,
    });
    assert.equal(repeat.status, 409);
    const activeAfterRepeat = await prisma.assetAuthorization.count({
      where: { assetId, status: "ACTIVE" },
    });
    assert.equal(activeAfterRepeat, 1);

    const ownerNominees = await api("/api/nominees", { cookie: env.ownerCookie });
    const ownerBody = (await ownerNominees.json()) as {
      nominees: Array<{
        requests: Array<{
          assetId: string;
          authorization: { id: string; status: string } | null;
        }>;
      }>;
    };
    const ownerNominee = ownerBody.nominees.find((nominee) =>
      nominee.requests.some((entry) => entry.assetId === assetId),
    );
    const ownerEntry = ownerNominee?.requests.find(
      (entry) => entry.assetId === assetId,
    );
    assert.equal(
      ownerEntry?.authorization?.id,
      newAuthId,
      "owner lookup must surface the ACTIVE authorization, not the revoked history",
    );
    assert.equal(ownerEntry?.authorization?.status, "ACTIVE");

    const nomineeView = await api(`/api/me/assets/${assetId}`, {
      cookie: env.nomineeCookie,
    });
    assert.equal(nomineeView.status, 200, "released request plus ACTIVE grant grants the whitelist view");

    const nomineeList = await api("/api/me/inheritance", {
      cookie: env.nomineeCookie,
    });
    const nomineeItems = ((await nomineeList.json()) as {
      items: Array<{ assetId: string; authorizationActive: boolean }>;
    }).items;
    const nomineeItem = nomineeItems.find((item) => item.assetId === assetId);
    assert.equal(nomineeItem?.authorizationActive, true);

    const revoke = await api(`/api/authorizations/${newAuthId}/revoke`, {
      method: "POST",
      cookie: env.ownerCookie,
    });
    assert.equal(revoke.status, 200);

    const viewAfterRevoke = await api(`/api/me/assets/${assetId}`, {
      cookie: env.nomineeCookie,
    });
    assert.equal(viewAfterRevoke.status, 404, "revoking the new grant must deny recovery access");

    const listAfterRevoke = await api("/api/me/inheritance", {
      cookie: env.nomineeCookie,
    });
    const itemsAfterRevoke = ((await listAfterRevoke.json()) as {
      items: Array<{ assetId: string; authorizationActive: boolean }>;
    }).items;
    const itemAfterRevoke = itemsAfterRevoke.find((entry) => entry.assetId === assetId);
    assert.equal(itemAfterRevoke?.authorizationActive, false);

    const oldRowAfterRevoke = await prisma.assetAuthorization.findUnique({
      where: { id: revokedAuthId },
    });
    assert.equal(oldRowAfterRevoke?.status, "REVOKED");
    assert.ok(oldRowAfterRevoke?.revokedAt);
  });
});

describe("claim-code lockout hardening and terminal decline guards", () => {
  test("a locked request stays locked regardless of payload and remains declinable", async () => {
    const assetId = await createAsset(env.ownerCookie, "Suite Lockout Hardening Asset");
    const pair = await invite(env.ownerCookie, assetId, env.created.nomineeId);

    for (let i = 0; i < 5; i += 1) {
      const attempt = await api(`/api/me/inheritance/${pair.id}/claim`, {
        method: "POST",
        cookie: env.nomineeCookie,
        body: { attestation: true, claimCode: `lockout-bad-${i}` },
      });
      assert.equal(attempt.status, 400);
    }

    const withoutCode = await api(`/api/me/inheritance/${pair.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });
    assert.equal(withoutCode.status, 409, "omitting the code must not dodge the lock");
    const withoutCodeBody = (await withoutCode.json()) as { code?: string };
    assert.equal(withoutCodeBody.code, "CLAIM_CODE_LOCKED");

    const withRealCode = await api(`/api/me/inheritance/${pair.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true, claimCode: pair.claimCode },
    });
    assert.equal(withRealCode.status, 409, "the genuine code stays refused while locked");
    const withRealCodeBody = (await withRealCode.json()) as { code?: string };
    assert.equal(withRealCodeBody.code, "CLAIM_CODE_LOCKED");

    const row = await prisma.inheritanceRequest.findUnique({ where: { id: pair.id } });
    assert.equal(row?.claimCodeAttempts, 5, "attempts must never exceed the cap");
    assert.equal(row?.status, "INVITED", "locking must not change the status");

    const events = await prisma.inheritanceEvent.count({ where: { requestId: pair.id } });
    assert.equal(events, 1, "only the invitation event exists; failed attempts add none");

    const decline = await api(`/api/me/inheritance/${pair.id}/decline`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: {},
    });
    assert.equal(decline.status, 200, "decline stays available on a locked but open request");
  });

  test("decline from every open state persists the reason; terminal requests refuse further transitions", async () => {
    const eligibleAsset = await createAsset(env.ownerCookie, "Suite Decline-Eligible Asset");
    const eligiblePair = await invite(env.ownerCookie, eligibleAsset, env.created.nomineeId);
    const claimed = await api(`/api/me/inheritance/${eligiblePair.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true, claimCode: eligiblePair.claimCode },
    });
    assert.equal(claimed.status, 200);

    const eligibleDecline = await api(`/api/me/inheritance/${eligiblePair.id}/decline`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { reason: "Changed my mind after eligibility." },
    });
    assert.equal(eligibleDecline.status, 200);

    const eligibleRow = await prisma.inheritanceRequest.findUnique({
      where: { id: eligiblePair.id },
    });
    assert.equal(eligibleRow?.status, "DECLINED");
    assert.equal(eligibleRow?.declineReason, "Changed my mind after eligibility.");

    const declineEvents = await prisma.inheritanceEvent.findMany({
      where: { requestId: eligiblePair.id, action: "DECLINED" },
    });
    assert.equal(declineEvents.length, 1, "exactly one decline event");
    assert.ok(
      declineEvents[0]?.note?.includes("Changed my mind after eligibility."),
      "the reason must be captured in the audit note",
    );

    const pendingAsset = await createAsset(env.ownerCookie, "Suite Decline-Pending Asset");
    const pendingPair = await invite(env.ownerCookie, pendingAsset, env.created.nomineeId);
    await api(`/api/me/inheritance/${pendingPair.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true, claimCode: pendingPair.claimCode },
    });
    const submitted = await api(`/api/me/inheritance/${pendingPair.id}/submit-claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });
    assert.equal(submitted.status, 200);

    const pendingDecline = await api(`/api/me/inheritance/${pendingPair.id}/decline`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: {},
    });
    assert.equal(pendingDecline.status, 200, "decline stays open until the owner decides");

    const claimAfter = await api(`/api/me/inheritance/${pendingPair.id}/claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true, claimCode: pendingPair.claimCode },
    });
    assert.equal(claimAfter.status, 409);
    const claimAfterBody = (await claimAfter.json()) as { code?: string };
    assert.equal(claimAfterBody.code, "INVALID_STATE");

    const submitAfter = await api(`/api/me/inheritance/${pendingPair.id}/submit-claim`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: { attestation: true },
    });
    assert.equal(submitAfter.status, 409);

    const declineAfter = await api(`/api/me/inheritance/${pendingPair.id}/decline`, {
      method: "POST",
      cookie: env.nomineeCookie,
      body: {},
    });
    assert.equal(declineAfter.status, 409, "terminal requests cannot be declined again");

    const terminalEvents = await prisma.inheritanceEvent.count({
      where: { requestId: pendingPair.id, action: "DECLINED" },
    });
    assert.equal(terminalEvents, 1, "terminal transitions must not duplicate audit events");

    const authorizations = await prisma.assetAuthorization.count({
      where: { assetId: pendingAsset },
    });
    assert.equal(authorizations, 0, "decline must never create authorizations");
  });
});

describe("data preservation and demo integrity", () => {
  test("demo rows were never mutated by the suite", async () => {
    const demoRequests = await prisma.inheritanceRequest.count({
      where: { isDemo: true },
    });
    const demoEvents = await prisma.inheritanceEvent.count({
      where: { request: { isDemo: true } },
    });
    const demoAuthorizations = await prisma.assetAuthorization.count({
      where: { isDemo: true },
    });
    const demoNotifications = await prisma.notification.count({
      where: { isDemo: true },
    });
    assert.equal(demoRequests, env.baseline.demoRequests);
    assert.equal(demoEvents, env.baseline.demoEvents);
    assert.equal(demoAuthorizations, env.baseline.demoAuthorizations);
    assert.equal(demoNotifications, env.baseline.demoNotifications);
  });

  test("historical events for the flow request were never rewritten", async () => {
    const events = await prisma.inheritanceEvent.findMany({
      where: { requestId: env.created.flowRequestId },
      orderBy: { createdAt: "asc" },
    });
    const actions = events.map((event) => event.action);
    assert.deepEqual(actions, [
      "INVITED",
      "ELIGIBILITY_MET",
      "CLAIM_STARTED",
      "IDENTITY_RECONFIRMED",
      "RELEASED",
      "REVOKED",
    ]);
    assert.ok(
      events.every((event) => event.actorId !== null),
      "every flow event keeps an actor",
    );
  });
});
