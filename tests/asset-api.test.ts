import "dotenv/config";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { prisma } from "@/lib/prisma";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
// Unique simulated client IP so auth rate limits are isolated per suite.
const TEST_IP = "198.51.100.11";

const OWNER_EMAIL = "slice4-test-owner@example.com";
const INTRUDER_EMAIL = "slice4-test-intruder@example.com";
const TEST_PASSWORD = "Slice4-Test-Pass-9021!";
const DEMO_EMAIL = "ada@demo.local";
const DEMO_PASSWORD = "DemoPass123!";

type Env = {
  ownerCookie: string;
  ownerUserId: string;
  intruderCookie: string;
  intruderUserId: string;
  baseline: {
    demoAssets: number;
    demoUsers: number;
    inheritanceRequests: number;
  };
  created: {
    ownerAssetId: string;
    sentinelAssetId: string;
    intruderAssetId: string;
    deletableAssetId: string;
  };
};

const env: Env = {
  ownerCookie: "",
  ownerUserId: "",
  intruderCookie: "",
  intruderUserId: "",
  baseline: { demoAssets: 0, demoUsers: 0, inheritanceRequests: 0 },
  created: {
    ownerAssetId: "",
    sentinelAssetId: "",
    intruderAssetId: "",
    deletableAssetId: "",
  },
};

function cookieHeader(response: Response): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

async function signUp(email: string): Promise<{ cookie: string; userId: string }> {
  const name = email.startsWith("slice4-test-owner") ? "Slice4 Test Owner" : "Slice4 Test Intruder";
  const response = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, "X-Forwarded-For": TEST_IP },
    body: JSON.stringify({ email, name, password: TEST_PASSWORD }),
  });
  assert.equal(response.status, 200, `sign-up for ${email} returned ${response.status}`);

  // Email verification is enforced: sign-up creates the account unverified
  // and Better Auth withholds the session. Mark this test account verified,
  // then sign in — verified users retain full access.
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
    where: { email: { in: [OWNER_EMAIL, INTRUDER_EMAIL] } },
  });

  env.baseline.demoAssets = await prisma.asset.count({ where: { isDemo: true } });
  env.baseline.demoUsers = await prisma.user.count({
    where: { email: { endsWith: "@demo.local" } },
  });
  env.baseline.inheritanceRequests = await prisma.inheritanceRequest.count();

  const owner = await signUp(OWNER_EMAIL);
  env.ownerCookie = owner.cookie;
  env.ownerUserId = owner.userId;

  const intruder = await signUp(INTRUDER_EMAIL);
  env.intruderCookie = intruder.cookie;
  env.intruderUserId = intruder.userId;

  const ownerCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.ownerCookie,
    body: {
      title: "Owner Primary Wallet",
      category: "CRYPTO",
      providerName: "Coinbase",
      estimatedValue: 1500.5,
      currency: "USD",
      description: "Created by the slice 4 test suite.",
      accountReference: "handle: owner-wallet (fictional)",
      officialUrl: "https://www.coinbase.com",
    },
  });
  assert.equal(ownerCreate.status, 201);
  env.created.ownerAssetId = ((await ownerCreate.json()) as { id: string }).id;

  const sentinelCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.ownerCookie,
    body: {
      title: "Sentinel Asset",
      category: "OTHER",
      providerName: "Test Suite",
      estimatedValue: 42,
      currency: "INR",
    },
  });
  assert.equal(sentinelCreate.status, 201);
  env.created.sentinelAssetId = ((await sentinelCreate.json()) as { id: string }).id;

  const intruderCreate = await api("/api/assets", {
    method: "POST",
    cookie: env.intruderCookie,
    body: {
      title: "Intruder Asset",
      category: "GAMING",
      providerName: "Epic Games",
      estimatedValue: 999,
      currency: "INR",
    },
  });
  assert.equal(intruderCreate.status, 201);
  env.created.intruderAssetId = ((await intruderCreate.json()) as { id: string }).id;
});

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `sign-in for ${email} returned ${response.status}`);
  return cookieHeader(response);
}

after(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [OWNER_EMAIL, INTRUDER_EMAIL] } },
  });
  await prisma.$disconnect();
});

describe("authentication", () => {
  test("unauthenticated requests are rejected with 401", async () => {
    const list = await api("/api/assets");
    assert.equal(list.status, 401);

    const create = await api("/api/assets", {
      method: "POST",
      body: {
        title: "Nope",
        category: "OTHER",
        providerName: "Nope",
        estimatedValue: 1,
        currency: "INR",
      },
    });
    assert.equal(create.status, 401);

    const read = await api(`/api/assets/${env.created.ownerAssetId}`);
    assert.equal(read.status, 401);

    const update = await api(`/api/assets/${env.created.ownerAssetId}`, {
      method: "PATCH",
      body: { title: "Hijacked" },
    });
    assert.equal(update.status, 401);
  });

  test("get-session works for the authenticated owner", async () => {
    const response = await api("/api/auth/get-session", {
      cookie: env.ownerCookie,
    });
    assert.equal(response.status, 200);
    const session = (await response.json()) as { user?: { id?: string } } | null;
    assert.equal(session?.user?.id, env.ownerUserId);
  });
});

describe("creation", () => {
  test("sets owner from the session and ignores client-supplied owner fields", async () => {
    const asset = await prisma.asset.findUnique({
      where: { id: env.created.ownerAssetId },
    });
    assert.ok(asset, "created asset must exist");
    assert.equal(asset.ownerId, env.ownerUserId);
    assert.notEqual(asset.ownerId, env.intruderUserId);
    assert.equal(asset.isDemo, false);
    assert.equal(asset.status, "ACTIVE");
    assert.equal(asset.title, "Owner Primary Wallet");
    assert.equal(asset.estimatedValue.toNumber(), 1500.5);
    assert.equal(asset.currency, "USD");
  });

  test("stores the validated official URL as an official link", async () => {
    const links = await prisma.officialLink.findMany({
      where: { assetId: env.created.ownerAssetId, type: "OFFICIAL_SITE" },
    });
    assert.equal(links.length, 1);
    assert.equal(links[0].url, "https://www.coinbase.com");
  });

  test("rejects invalid payloads with field-level errors and stores nothing", async () => {
    const beforeCount = await prisma.asset.count({
      where: { ownerId: env.ownerUserId },
    });

    const response = await api("/api/assets", {
      method: "POST",
      cookie: env.ownerCookie,
      body: {
        title: "",
        category: "STOCKS",
        providerName: "",
        estimatedValue: -5,
        currency: "JPY",
        officialUrl: "javascript:alert(1)",
        ownerId: env.intruderUserId,
        isDemo: true,
      },
    });

    assert.equal(response.status, 400);
    const body = (await response.json()) as {
      error?: string;
      fields?: Record<string, string>;
    };
    assert.equal(body.error, "Validation failed.");
    assert.ok(body.fields?.title, "expected a title error");
    assert.ok(body.fields?.category, "expected a category error");
    assert.ok(body.fields?.providerName, "expected a providerName error");
    assert.ok(body.fields?.estimatedValue, "expected an estimatedValue error");
    assert.ok(body.fields?.currency, "expected a currency error");
    assert.ok(body.fields?.officialUrl, "expected an officialUrl error");

    const afterCount = await prisma.asset.count({
      where: { ownerId: env.ownerUserId },
    });
    assert.equal(afterCount, beforeCount, "invalid payload must not create rows");
  });
});

describe("scoping and ownership", () => {
  test("each user only lists their own assets", async () => {
    const ownerList = (await (
      await api("/api/assets", { cookie: env.ownerCookie })
    ).json()) as { assets: Array<{ id: string }> };
    const intruderList = (await (
      await api("/api/assets", { cookie: env.intruderCookie })
    ).json()) as { assets: Array<{ id: string }> };

    const ownerIds = ownerList.assets.map((asset) => asset.id);
    const intruderIds = intruderList.assets.map((asset) => asset.id);

    assert.ok(ownerIds.includes(env.created.ownerAssetId));
    assert.ok(ownerIds.includes(env.created.sentinelAssetId));
    assert.ok(!ownerIds.includes(env.created.intruderAssetId));

    assert.ok(intruderIds.includes(env.created.intruderAssetId));
    assert.ok(!intruderIds.includes(env.created.ownerAssetId));

    const ownerRows = await prisma.asset.findMany({
      where: { id: { in: [...ownerIds, ...intruderIds] } },
      select: { id: true, ownerId: true },
    });
    for (const row of ownerRows) {
      const expected = ownerIds.includes(row.id)
        ? env.ownerUserId
        : env.intruderUserId;
      assert.equal(row.ownerId, expected, `wrong owner for ${row.id}`);
    }
  });

  test("owner can read their asset; another user gets a generic 404", async () => {
    const own = await api(`/api/assets/${env.created.ownerAssetId}`, {
      cookie: env.ownerCookie,
    });
    assert.equal(own.status, 200);
    const ownBody = (await own.json()) as { asset?: { id?: string; estimatedValue?: number } };
    assert.equal(ownBody.asset?.id, env.created.ownerAssetId);
    assert.equal(ownBody.asset?.estimatedValue, 1500.5);

    const foreign = await api(`/api/assets/${env.created.ownerAssetId}`, {
      cookie: env.intruderCookie,
    });
    assert.equal(foreign.status, 404);
    const foreignBody = (await foreign.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(foreignBody), ["error"]);
    assert.equal(foreignBody.error, "Asset not found.");
  });

  test("owner can edit their asset; another user's edit is rejected", async () => {
    const edit = await api(`/api/assets/${env.created.ownerAssetId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: {
        title: "Owner Primary Wallet (renamed)",
        estimatedValue: 1750.25,
        description: "Updated by the owner.",
      },
    });
    assert.equal(edit.status, 200);

    const updated = await prisma.asset.findUnique({
      where: { id: env.created.ownerAssetId },
    });
    assert.equal(updated?.title, "Owner Primary Wallet (renamed)");
    assert.equal(updated?.estimatedValue.toNumber(), 1750.25);

    const attack = await api(`/api/assets/${env.created.ownerAssetId}`, {
      method: "PATCH",
      cookie: env.intruderCookie,
      body: { title: "Hijacked title" },
    });
    assert.equal(attack.status, 404);

    const afterAttack = await prisma.asset.findUnique({
      where: { id: env.created.ownerAssetId },
    });
    assert.equal(afterAttack?.title, "Owner Primary Wallet (renamed)");
  });

  test("editing one asset does not modify unrelated assets", async () => {
    const before = await prisma.asset.findUnique({
      where: { id: env.created.sentinelAssetId },
    });

    const edit = await api(`/api/assets/${env.created.ownerAssetId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: { providerName: "Coinbase Advanced" },
    });
    assert.equal(edit.status, 200);

    const after = await prisma.asset.findUnique({
      where: { id: env.created.sentinelAssetId },
    });
    assert.ok(after);
    assert.equal(after.title, before!.title);
    assert.equal(after.estimatedValue.toNumber(), 42);
    assert.equal(after.updatedAt.getTime(), before!.updatedAt.getTime());
  });

  test("PATCH cannot change the owner (mass assignment)", async () => {
    const response = await api(`/api/assets/${env.created.ownerAssetId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: { ownerId: env.intruderUserId, title: "Still owned by owner" },
    });
    assert.equal(response.status, 200);

    const asset = await prisma.asset.findUnique({
      where: { id: env.created.ownerAssetId },
    });
    assert.equal(asset?.ownerId, env.ownerUserId);
    assert.equal(asset?.title, "Still owned by owner");
  });

  test("PATCH validates input", async () => {
    const response = await api(`/api/assets/${env.created.ownerAssetId}`, {
      method: "PATCH",
      cookie: env.ownerCookie,
      body: { estimatedValue: -50, currency: "JPY" },
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { fields?: Record<string, string> };
    assert.ok(body.fields?.estimatedValue);
    assert.ok(body.fields?.currency);
  });

  test("unknown asset ids return a generic 404", async () => {
    const response = await api("/api/assets/does-not-exist", {
      cookie: env.ownerCookie,
    });
    assert.equal(response.status, 404);
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body), ["error"]);
  });
});

describe("deletion", () => {
  test("fixture: owner creates an asset with a link to delete", async () => {
    const response = await api("/api/assets", {
      method: "POST",
      cookie: env.ownerCookie,
      body: {
        title: "Deletable Asset",
        category: "DOMAIN",
        providerName: "GoDaddy",
        estimatedValue: 100,
        currency: "INR",
        officialUrl: "https://www.godaddy.com",
      },
    });
    assert.equal(response.status, 201);
    env.created.deletableAssetId = ((await response.json()) as { id: string }).id;
  });

  test("unauthenticated delete is rejected", async () => {
    const response = await api(`/api/assets/${env.created.deletableAssetId}`, {
      method: "DELETE",
    });
    assert.equal(response.status, 401);
    const asset = await prisma.asset.findUnique({
      where: { id: env.created.deletableAssetId },
    });
    assert.ok(asset, "asset must survive an unauthenticated delete");
  });

  test("another user cannot delete someone else's asset", async () => {
    const response = await api(`/api/assets/${env.created.deletableAssetId}`, {
      method: "DELETE",
      cookie: env.intruderCookie,
    });
    assert.equal(response.status, 404);
    const asset = await prisma.asset.findUnique({
      where: { id: env.created.deletableAssetId },
    });
    assert.ok(asset, "asset must survive a foreign delete");
    assert.equal(asset.ownerId, env.ownerUserId);
  });

  test("owner delete succeeds and removes asset-scoped records", async () => {
    const linksBefore = await prisma.officialLink.count({
      where: { assetId: env.created.deletableAssetId },
    });
    assert.equal(linksBefore, 1);

    const response = await api(`/api/assets/${env.created.deletableAssetId}`, {
      method: "DELETE",
      cookie: env.ownerCookie,
    });
    assert.equal(response.status, 200);

    const asset = await prisma.asset.findUnique({
      where: { id: env.created.deletableAssetId },
    });
    assert.equal(asset, null);

    const linksAfter = await prisma.officialLink.count({
      where: { assetId: env.created.deletableAssetId },
    });
    assert.equal(linksAfter, 0, "asset-scoped links are removed with the asset");

    const readAfter = await api(`/api/assets/${env.created.deletableAssetId}`, {
      cookie: env.ownerCookie,
    });
    assert.equal(readAfter.status, 404);
  });

  test("asset linked to inheritance records is refused with 409 and preserved", async () => {
    const demoCookie = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    const protectedAssetId = "demo__asset_coinbase";

    const inheritanceBefore = await prisma.inheritanceRequest.count({
      where: { assetId: protectedAssetId },
    });
    assert.ok(inheritanceBefore > 0, "fixture asset must have inheritance records");

    const response = await api(`/api/assets/${protectedAssetId}`, {
      method: "DELETE",
      cookie: demoCookie,
    });
    assert.equal(response.status, 409);
    const body = (await response.json()) as { error?: string; code?: string };
    assert.equal(body.code, "HAS_INHERITANCE_RECORDS");
    assert.ok(body.error);

    const asset = await prisma.asset.findUnique({
      where: { id: protectedAssetId },
    });
    assert.ok(asset, "protected asset must survive the delete attempt");

    const inheritanceAfter = await prisma.inheritanceRequest.count({
      where: { assetId: protectedAssetId },
    });
    assert.equal(inheritanceAfter, inheritanceBefore, "inheritance records intact");
  });

  test("protected asset can be archived and restored instead", async () => {
    const demoCookie = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    const protectedAssetId = "demo__asset_coinbase";

    const archive = await api(`/api/assets/${protectedAssetId}`, {
      method: "PATCH",
      cookie: demoCookie,
      body: { status: "ARCHIVED" },
    });
    assert.equal(archive.status, 200);
    const archived = await prisma.asset.findUnique({
      where: { id: protectedAssetId },
    });
    assert.equal(archived?.status, "ARCHIVED");

    const restore = await api(`/api/assets/${protectedAssetId}`, {
      method: "PATCH",
      cookie: demoCookie,
      body: { status: "ACTIVE" },
    });
    assert.equal(restore.status, 200);
    const restored = await prisma.asset.findUnique({
      where: { id: protectedAssetId },
    });
    assert.equal(restored?.status, "ACTIVE", "demo state restored");
  });
});

describe("existing data preserved", () => {
  test("demo users, demo assets and inheritance requests are untouched", async () => {
    const demoAssets = await prisma.asset.count({ where: { isDemo: true } });
    const demoUsers = await prisma.user.count({
      where: { email: { endsWith: "@demo.local" } },
    });
    const inheritanceRequests = await prisma.inheritanceRequest.count();

    assert.equal(demoAssets, env.baseline.demoAssets);
    assert.equal(demoUsers, env.baseline.demoUsers);
    assert.equal(inheritanceRequests, env.baseline.inheritanceRequests);
  });

  test("no passwords or secrets are stored on assets", async () => {
    const assets = await prisma.asset.findMany({
      where: { ownerId: { in: [env.ownerUserId, env.intruderUserId] } },
    });
    assert.ok(assets.length >= 3);
    for (const asset of assets) {
      const combined = [
        asset.title,
        asset.description ?? "",
        asset.accountReference ?? "",
        asset.recoveryInstructions ?? "",
        asset.ownershipEvidence ?? "",
      ]
        .join(" ")
        .toLowerCase();
      assert.ok(!combined.includes(TEST_PASSWORD.toLowerCase()));
      assert.ok(!combined.includes("seed phrase"));
      assert.ok(!combined.includes("private key"));
    }
  });
});
