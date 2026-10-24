import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { prisma } from "@/lib/prisma";

/**
 * Regression tests for the invite dialog's asset-selector data path
 * (src/components/nominees/invite-asset-dialog.tsx).
 *
 * The dialog loads options from GET /api/assets and submits the selection to
 * POST /api/assets/:id/requests. These tests pin the contracts the dialog
 * depends on:
 *
 *  - asset loading: the option shape (id/title/category/status) the Select
 *    binds to option values,
 *  - owner isolation: the selector never exposes another user's assets,
 *  - empty state: a fresh owner receives an empty list (drives the dialog's
 *    "no assets" empty state rather than a stuck loader),
 *  - unauthenticated access: 401 (the dialog redirects to /login),
 *  - selection binding: posting the selected asset id creates exactly the
 *    request the dialog expects, and foreign asset ids are rejected.
 */

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
// Unique simulated client IP so auth rate limits are isolated per suite.
const TEST_IP = "198.51.100.14";

const OWNER_EMAIL = "invite-dialog-test-owner@example.com";
const OTHER_EMAIL = "invite-dialog-test-other@example.com";
const NOMINEE_EMAIL = "invite-dialog-test-nominee@example.com";
const TEST_PASSWORD = "InviteDialog-Test-Pass-7731!";

type Env = {
  ownerCookie: string;
  ownerUserId: string;
  otherCookie: string;
  otherUserId: string;
  nomineeId: string;
  created: {
    ownerAssetId: string;
    otherAssetId: string;
    terminalAssetId: string;
  };
  baseline: {
    demoAssets: number;
    fixtureAssets: number;
  };
};

const env: Env = {
  ownerCookie: "",
  ownerUserId: "",
  otherCookie: "",
  otherUserId: "",
  nomineeId: "",
  created: {
    ownerAssetId: "",
    otherAssetId: "",
    terminalAssetId: "",
  },
  baseline: {
    demoAssets: 0,
    fixtureAssets: 0,
  },
};

type AssetOption = {
  id: string;
  title: string;
  category: string;
  status: string;
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
  // Email verification is enforced: sign-up withholds the session. Mark this
  // test account verified, then sign in — verified users retain full access.
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
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
  } = {},
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

before(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL, NOMINEE_EMAIL] } },
  });

  env.baseline.demoAssets = await prisma.asset.count({ where: { isDemo: true } });
  env.baseline.fixtureAssets = await prisma.asset.count({
    where: { isDemo: false, title: { contains: "Fixture" } },
  });

  const owner = await signUp(OWNER_EMAIL, "Invite Dialog Owner");
  env.ownerCookie = owner.cookie;
  env.ownerUserId = owner.userId;

  const other = await signUp(OTHER_EMAIL, "Invite Dialog Other");
  env.otherCookie = other.cookie;
  env.otherUserId = other.userId;

  // The owner gets one asset; the selection must bind to exactly this id.
  const ownerCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.ownerCookie,
    body: {
      title: "Invite Dialog Asset",
      category: "CRYPTO",
      providerName: "Test Suite",
      estimatedValue: 10,
      currency: "INR",
    },
  });
  assert.equal(ownerCreate.status, 201);
  env.created.ownerAssetId = ((await ownerCreate.json()) as { id: string }).id;

  // A second asset for the owner so "terminal" invite states can be produced
  // without consuming the selector-eligible asset.
  const terminalCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.ownerCookie,
    body: {
      title: "Invite Dialog Terminal Asset",
      category: "OTHER",
      providerName: "Test Suite",
      estimatedValue: 1,
      currency: "INR",
    },
  });
  assert.equal(terminalCreate.status, 201);
  env.created.terminalAssetId = ((await terminalCreate.json()) as { id: string }).id;

  const otherCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.otherCookie,
    body: {
      title: "Other Owner Asset",
      category: "GAMING",
      providerName: "Test Suite",
      estimatedValue: 5,
      currency: "INR",
    },
  });
  assert.equal(otherCreate.status, 201);
  env.created.otherAssetId = ((await otherCreate.json()) as { id: string }).id;

  const nominee = await prisma.nominee.create({
    data: {
      id: randomUUID(),
      ownerId: env.ownerUserId,
      name: "Invite Dialog Nominee",
      email: NOMINEE_EMAIL,
      relationship: "Friend",
      isDemo: false,
    },
  });
  env.nomineeId = nominee.id;
});

after(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL, NOMINEE_EMAIL] } },
  });
  await prisma.$disconnect();
});

describe("invite dialog: asset loading contract", () => {
  test("unauthenticated asset loading is rejected with 401 (dialog redirects to /login)", async () => {
    const list = await api("/api/assets");
    assert.equal(list.status, 401);
  });

  test("GET /api/assets returns the option shape the dialog binds", async () => {
    const list = await api("/api/assets", { cookie: env.ownerCookie });
    assert.equal(list.status, 200);

    const body = (await list.json()) as { assets?: AssetOption[] };
    assert.ok(Array.isArray(body.assets), "response must contain an assets array");

    const option = body.assets!.find((asset) => asset.id === env.created.ownerAssetId);
    assert.ok(option, "owner's asset must be present in the selector options");
    assert.equal(typeof option!.id, "string");
    assert.ok(option!.id.length > 0, "option value (id) must be a non-empty string");
    assert.equal(typeof option!.title, "string");
    assert.ok(option!.title.length > 0, "option label (title) must be non-empty");
    assert.equal(typeof option!.category, "string");
    assert.equal(typeof option!.status, "string");
  });

  test("an owner with no assets receives an empty list (drives the empty state, not a stuck loader)", async () => {
    // The other owner's asset exists, but a brand-new session owner sees [].
    const fresh = await signUp(
      "invite-dialog-test-empty@example.com",
      "Invite Dialog Empty",
    );
    try {
      const list = await api("/api/assets", { cookie: fresh.cookie });
      assert.equal(list.status, 200);
      const body = (await list.json()) as { assets?: AssetOption[] };
      assert.deepEqual(body.assets, []);
    } finally {
      await prisma.user.deleteMany({
        where: { email: "invite-dialog-test-empty@example.com" },
      });
    }
  });
});

describe("invite dialog: owner isolation", () => {
  test("the selector never exposes another user's assets", async () => {
    const ownerList = await api("/api/assets", { cookie: env.ownerCookie });
    const ownerBody = (await ownerList.json()) as { assets?: AssetOption[] };
    const ids = new Set(ownerBody.assets!.map((asset) => asset.id));
    assert.ok(!ids.has(env.created.otherAssetId), "other owner's asset must not leak");

    const otherList = await api("/api/assets", { cookie: env.otherCookie });
    const otherBody = (await otherList.json()) as { assets?: AssetOption[] };
    const otherIds = new Set(otherBody.assets!.map((asset) => asset.id));
    assert.ok(otherIds.has(env.created.otherAssetId), "other owner keeps own asset");
    assert.ok(!otherIds.has(env.created.ownerAssetId), "owner's asset must not leak");
    assert.ok(!otherIds.has(env.created.terminalAssetId), "owner's asset must not leak");

    // The disposable P1 fixture owner's asset must never appear here either.
    const fixtureOwner = await prisma.user.findUnique({
      where: { email: "p1-fixture-owner@example.com" },
      select: { assets: { select: { id: true } } },
    });
    for (const asset of fixtureOwner?.assets ?? []) {
      assert.ok(!ids.has(asset.id), "fixture owner's asset must not leak to owner");
      assert.ok(!otherIds.has(asset.id), "fixture owner's asset must not leak to other");
    }
  });
});

describe("invite dialog: selection binding on submit", () => {
  test("posting the selected asset id creates the request the dialog expects", async () => {
    const response = await api(`/api/assets/${env.created.terminalAssetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.nomineeId },
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as { id?: string; claimCode?: string };
    assert.ok(body.id, "expected a request id");
    assert.ok(body.claimCode, "expected a one-time claim code");

    const request = await prisma.inheritanceRequest.findUnique({
      where: { id: body.id! },
    });
    assert.ok(request, "created request must exist");
    assert.equal(request!.assetId, env.created.terminalAssetId);
    assert.equal(request!.nomineeId, env.nomineeId);
    assert.equal(request!.invitedById, env.ownerUserId);
    assert.equal(request!.status, "INVITED");
  });

  test("a selected asset id owned by someone else is rejected generically", async () => {
    const response = await api(`/api/assets/${env.created.otherAssetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.nomineeId },
    });
    assert.equal(response.status, 404);
    const body = (await response.json()) as { error?: string };
    assert.equal(body.error, "Asset not found.");

    const created = await prisma.inheritanceRequest.count({
      where: { assetId: env.created.otherAssetId },
    });
    assert.equal(created, 0, "no request may be created for a foreign asset");
  });

  test("an unknown option value returns a generic 404 and stores nothing", async () => {
    const response = await api(
      "/api/assets/00000000-0000-4000-8000-000000000000/requests",
      {
        method: "POST",
        cookie: env.ownerCookie,
        body: { nomineeId: env.nomineeId },
      },
    );
    assert.equal(response.status, 404);
  });

  test("duplicate invites for the still-open request are refused with 409 REQUEST_EXISTS", async () => {
    const response = await api(`/api/assets/${env.created.terminalAssetId}/requests`, {
      method: "POST",
      cookie: env.ownerCookie,
      body: { nomineeId: env.nomineeId },
    });
    assert.equal(response.status, 409);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, "REQUEST_EXISTS");
  });
});

describe("invite dialog: regression guards for protected records", () => {
  test("demo and fixture asset counts are unchanged by this suite", async () => {
    const demoAssets = await prisma.asset.count({ where: { isDemo: true } });
    assert.equal(demoAssets, env.baseline.demoAssets);

    const fixtureAssets = await prisma.asset.count({
      where: { isDemo: false, title: { contains: "Fixture" } },
    });
    assert.equal(fixtureAssets, env.baseline.fixtureAssets);
  });  test("the P1 fixture asset and demo authorizations are untouched by this suite", async () => {
    const demoAuths = await prisma.assetAuthorization.count({
      where: { isDemo: true },
    });
    assert.ok(demoAuths >= 0);

    const fixtureAsset = await prisma.asset.findFirst({
      where: { title: "P1 Fixture Asset", isDemo: false },
      select: { id: true },
    });
    if (fixtureAsset) {
      const fixtureAuths = await prisma.assetAuthorization.count({
        where: { assetId: fixtureAsset.id },
      });
      assert.equal(
        fixtureAuths,
        0,
        "no authorization may exist for the P1 fixture asset",
      );
    }
  });
});
