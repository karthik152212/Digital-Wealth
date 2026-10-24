/**
 * Digital Wealth Vault — deterministic demo seed.
 *
 * - Idempotent: every row uses a fixed `demo__*` id and is upserted.
 * - Safe: refuses to run when personal (non-demo) users exist unless
 *   SEED_ALLOW_PERSONAL=1 is set; and even then only ever writes demo__ rows.
 * - Fictional: all data is invented for a university demonstration. All
 *   valuations are fictional estimates, not financial advice.
 * - Passwords are hashed with Better Auth's hashPassword (scrypt) — the
 *   plaintext never touches the database.
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_PASSWORD = "DemoPass123!"; // disposable, fictional, documented in README

// Fixed reference dates so the seed is fully deterministic.
const D = {
  now: new Date("2026-10-15T12:00:00.000Z"),
  invitedAt: new Date("2026-10-15T12:00:00.000Z"),
  graceEndsAt: new Date("2026-10-18T12:00:00.000Z"),
  eligibleAt: new Date("2026-10-18T12:05:00.000Z"),
  claimedAt: new Date("2026-10-18T12:10:00.000Z"),
  releasedAt: new Date("2026-10-18T12:15:00.000Z"),
  inactive: new Date("2026-07-01T08:00:00.000Z"),
} as const;

async function assertSafeToSeed(): Promise<void> {
  const personalUsers = await prisma.user.count({ where: { isDemo: false } });
  if (personalUsers > 0) {
    const force = process.env.SEED_ALLOW_PERSONAL === "1";
    if (!force) {
      console.error(
        `[seed] REFUSING to seed: ${personalUsers} personal (non-demo) user(s) exist.\n` +
          `[seed] This guard prevents accidental mixing of demo data with real records.\n` +
          `[seed] To seed anyway (demo__* rows only, personal rows untouched), set SEED_ALLOW_PERSONAL=1.`
      );
      process.exit(1);
    }
    console.warn(
      `[seed] SEED_ALLOW_PERSONAL=1 set — proceeding. Only demo__* rows will be written; ${personalUsers} personal user(s) are untouched.`
    );
  }
}

async function main() {
  await assertSafeToSeed();
  console.log("[seed] Safety check passed. Seeding demo data...");

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // --- Users (fixed demo ids) ---
  await prisma.user.upsert({
    where: { id: "demo__user_ada" },
    update: { isDemo: true, lastSeenAt: D.inactive },
    create: {
      id: "demo__user_ada",
      name: "Ada Lovelace",
      email: "ada@demo.local",
      emailVerified: true,
      isDemo: true,
      lastSeenAt: D.inactive,
    },
  });
  await prisma.user.upsert({
    where: { id: "demo__user_grace" },
    update: { isDemo: true, lastSeenAt: D.inactive },
    create: {
      id: "demo__user_grace",
      name: "Grace Hopper",
      email: "grace@demo.local",
      emailVerified: true,
      isDemo: true,
      lastSeenAt: D.inactive,
    },
  });
  await prisma.user.upsert({
    where: { id: "demo__user_nominee_maya" },
    update: { isDemo: true },
    create: {
      id: "demo__user_nominee_maya",
      name: "Maya Nominee",
      email: "maya@demo.local",
      emailVerified: true,
      isDemo: true,
    },
  });

  // Accounts (credential provider) — password hash written only on create.
  const credentialAccounts = [
    { id: "demo__acct_ada", userId: "demo__user_ada", email: "ada@demo.local" },
    { id: "demo__acct_grace", userId: "demo__user_grace", email: "grace@demo.local" },
    {
      id: "demo__acct_maya",
      userId: "demo__user_nominee_maya",
      email: "maya@demo.local",
    },
  ];
  for (const acct of credentialAccounts) {
    await prisma.account.upsert({
      where: { id: acct.id },
      // accountId must equal the user id — Better Auth matches credential
      // accounts with accountId === user.id (see sign-in email route).
      update: { accountId: acct.userId },
      create: {
        id: acct.id,
        accountId: acct.userId,
        providerId: "credential",
        userId: acct.userId,
        password: passwordHash,
      },
    });
  }

  // --- Providers ---
  const providers = [
    {
      id: "demo__provider_steam",
      name: "Steam",
      websiteUrl: "https://store.steampowered.com",
      supportUrl: "https://help.steampowered.com",
      policyUrl: "https://store.steampowered.com/subscriber_agreement/",
      transferPolicy: "RESTRICTED" as const,
      policyNotes:
        "Steam accounts and their contents are personal and non-transferable under the Steam Subscriber Agreement.",
    },
    {
      id: "demo__provider_coinbase",
      name: "Coinbase",
      websiteUrl: "https://www.coinbase.com",
      supportUrl: "https://help.coinbase.com",
      policyUrl: "https://www.coinbase.com/legal/user_agreement",
      transferPolicy: "RESTRICTED" as const,
      policyNotes:
        "Cryptocurrency may be transferred to a wallet you control; Coinbase accounts themselves cannot be sold or transferred to another person.",
    },
    {
      id: "demo__provider_godaddy",
      name: "GoDaddy",
      websiteUrl: "https://www.godaddy.com",
      supportUrl: "https://www.godaddy.com/contact",
      policyUrl: "https://www.godaddy.com/legal/agreements",
      transferPolicy: "ALLOWED" as const,
      policyNotes:
        "Domain names can usually be transferred to another owner or registrar, subject to registry locks and ICANN rules.",
    },
    {
      id: "demo__provider_google",
      name: "Google",
      websiteUrl: "https://www.google.com",
      supportUrl: "https://support.google.com",
      policyUrl: "https://support.google.com/accounts/answer/157956",
      transferPolicy: "RESTRICTED" as const,
      policyNotes:
        "Google accounts are personal; Google provides an Inactive Account Manager for legacy contact designation.",
    },
    {
      id: "demo__provider_zerodha",
      name: "Zerodha",
      websiteUrl: "https://www.zerodha.com",
      supportUrl: "https://support.zerodha.com",
      policyUrl: "https://zerodha.com/legal",
      transferPolicy: "RESTRICTED" as const,
      policyNotes:
        "Trading accounts are not transferable. Nominees claim holdings through the broker's official transmission process.",
    },
    {
      id: "demo__provider_canva",
      name: "Canva",
      websiteUrl: "https://www.canva.com",
      supportUrl: "https://support.canva.com",
      policyUrl: "https://www.canva.com/policies/terms-of-use/",
      transferPolicy: "RESTRICTED" as const,
      policyNotes:
        "Canva Pro subscriptions are personal and non-transferable under Canva's Terms of Use.",
    },
  ];
  for (const p of providers) {
    await prisma.provider.upsert({
      where: { id: p.id },
      update: p,
      create: { ...p, isDemo: true },
    });
  }

  // --- Assets ---
  const assets = [
    {
      id: "demo__asset_steam",
      ownerId: "demo__user_ada",
      title: "Steam Game Library",
      description: "Personal game library with 140+ titles accumulated over 8 years.",
      category: "GAMING" as const,
      providerName: "Steam",
      providerId: "demo__provider_steam",
      accountReference: "steam id: 76561198000000000 (display: adalovelace)",
      estimatedValue: 85000,
      currency: "INR",
      valuationBasis: "Fictional replacement-cost estimate (not market value)",
      valuationDate: D.now,
      ownershipEvidence:
        "Purchase receipts in ada@demo.local inbox; public profile shows game count.",
      recoveryInstructions:
        "Use Steam Support account recovery with the registered email; have purchase receipts ready.",
      resaleEligible: false,
      resaleNotes: "Steam ToS prohibits selling or transferring game libraries.",
      isDemo: true,
    },
    {
      id: "demo__asset_coinbase",
      ownerId: "demo__user_ada",
      title: "Coinbase Portfolio",
      description: "Long-term holding account (BTC, ETH).",
      category: "CRYPTO" as const,
      providerName: "Coinbase",
      providerId: "demo__provider_coinbase",
      accountReference: "portfolio label: long-term-hold",
      estimatedValue: 250000,
      currency: "INR",
      valuationBasis: "Fictional snapshot value (not a market quote)",
      valuationDate: D.now,
      ownershipEvidence: "Monthly statements downloaded to ada@demo.local Drive.",
      recoveryInstructions:
        "Estate process: nominee contacts Coinbase Support with legal documents; funds move to a self-custody wallet.",
      resaleEligible: false,
      resaleNotes: "Account ownership transfer is prohibited; underlying crypto may be transferred.",
      isDemo: true,
    },
    {
      id: "demo__asset_godaddy",
      ownerId: "demo__user_ada",
      title: "Domain:adalovelace.dev",
      description: "Personal portfolio domain, renewed annually.",
      category: "DOMAIN" as const,
      providerName: "GoDaddy",
      providerId: "demo__provider_godaddy",
      accountReference: "registrar account: ada@demo.local",
      estimatedValue: 1200,
      currency: "INR",
      valuationBasis: "Fictional annual renewal cost estimate",
      valuationDate: D.now,
      ownershipEvidence: "Registrar dashboard login + ICANN confirmation emails.",
      recoveryInstructions:
        "Transfer via registrar unlock + auth code; nominee initiates transfer to their own registrar account.",
      resaleEligible: true,
      resaleNotes: "Domains may be transferred/sold per registrar and ICANN rules.",
      isDemo: true,
    },
    {
      id: "demo__asset_google_storage",
      ownerId: "demo__user_ada",
      title: "Google One Cloud Storage (2 TB)",
      description: "Family photo archive and document backups.",
      category: "CLOUD_STORAGE" as const,
      providerName: "Google",
      providerId: "demo__provider_google",
      accountReference: "storage plan: Google One 2 TB",
      estimatedValue: 6500,
      currency: "INR",
      valuationBasis: "Fictional annual subscription cost estimate",
      valuationDate: D.now,
      ownershipEvidence: "Subscription receipts in Google Pay history.",
      recoveryInstructions:
        "Nominee downloads archive via Inactive Account Manager; otherwise Google estate process applies.",
      resaleEligible: false,
      resaleNotes: "Subscription is personal and non-transferable.",
      isDemo: true,
    },
    {
      id: "demo__asset_zerodha",
      ownerId: "demo__user_ada",
      title: "Zerodha Trading Account",
      description: "Equity and mutual-fund holdings.",
      category: "INVESTMENT" as const,
      providerName: "Zerodha",
      providerId: "demo__provider_zerodha",
      accountReference: "client ID: AB1234 (fictional)",
      estimatedValue: 1200000,
      currency: "INR",
      valuationBasis: "Fictional portfolio snapshot (not real holdings)",
      valuationDate: D.now,
      ownershipEvidence: "CDSL/eCAS statements; registered mobile + email.",
      recoveryInstructions:
        "Nominee transmission: submit death/legal documents per SEBI LODR to Zerodha; holdings transfer to nominee's account.",
      resaleEligible: false,
      resaleNotes: "SEBI regulations and broker terms prohibit account sale.",
      isDemo: true,
    },
    {
      id: "demo__asset_canva_usd",
      ownerId: "demo__user_ada",
      title: "Canva Pro Team Seat",
      description: "Design account demonstrating non-INR currency storage.",
      category: "DIGITAL_CONTENT" as const,
      providerName: "Canva",
      providerId: "demo__provider_canva",
      accountReference: "team: adalovelace-designs",
      estimatedValue: 119.99,
      currency: "USD",
      valuationBasis: "Fictional annual subscription cost (USD stored per asset)",
      valuationDate: D.now,
      ownershipEvidence: "Billing history in account settings.",
      recoveryInstructions: "Nominee requests team-owner transfer via Canva Support.",
      resaleEligible: false,
      resaleNotes: "Team seats are personal and non-transferable.",
      isDemo: true,
    },
    {
      id: "demo__asset_youtube_channel",
      ownerId: "demo__user_grace",
      title: "YouTube Channel: GraceCodes",
      description: "Monetised education channel (fictional).",
      category: "SOCIAL_MEDIA" as const,
      providerName: "YouTube (Google)",
      providerId: "demo__provider_google",
      accountReference: "channel handle: @GraceCodes (fictional)",
      estimatedValue: 40000,
      currency: "INR",
      valuationBasis: "Fictional estimate based on fictional AdSense revenue",
      valuationDate: D.now,
      ownershipEvidence: "Channel dashboard access via linked Google account.",
      recoveryInstructions:
        "Heirship/estate process via YouTube's inheritance guidelines; channel ownership may be bequeathed.",
      resaleEligible: false,
      resaleNotes: "Channel sale violates YouTube ToS; ownership transfer only via estate process.",
      isDemo: true,
    },
  ];
  for (const a of assets) {
    await prisma.asset.upsert({ where: { id: a.id }, update: a, create: a });
  }

  // --- Valuation history ---
  const valuations = [
    { id: "demo__val_steam_1", assetId: "demo__asset_steam", value: 78000, currency: "INR", basis: "Q2 fictional estimate", valuedAt: new Date("2026-06-15T00:00:00.000Z"), recordedBy: "demo__user_ada" },
    { id: "demo__val_steam_2", assetId: "demo__asset_steam", value: 85000, currency: "INR", basis: "Q3 fictional estimate", valuedAt: new Date("2026-09-15T00:00:00.000Z"), recordedBy: "demo__user_ada" },
    { id: "demo__val_steam_3", assetId: "demo__asset_steam", value: 85000, currency: "INR", basis: "Current fictional estimate", valuedAt: D.now, recordedBy: "demo__user_ada" },
    { id: "demo__val_coinbase_1", assetId: "demo__asset_coinbase", value: 210000, currency: "INR", basis: "Q2 fictional snapshot", valuedAt: new Date("2026-06-15T00:00:00.000Z"), recordedBy: "demo__user_ada" },
    { id: "demo__val_coinbase_2", assetId: "demo__asset_coinbase", value: 250000, currency: "INR", basis: "Current fictional snapshot", valuedAt: D.now, recordedBy: "demo__user_ada" },
    { id: "demo__val_zerodha_1", assetId: "demo__asset_zerodha", value: 1150000, currency: "INR", basis: "Q2 fictional portfolio", valuedAt: new Date("2026-06-15T00:00:00.000Z"), recordedBy: "demo__user_ada" },
    { id: "demo__val_zerodha_2", assetId: "demo__asset_zerodha", value: 1200000, currency: "INR", basis: "Current fictional portfolio", valuedAt: D.now, recordedBy: "demo__user_ada" },
    { id: "demo__val_youtube_1", assetId: "demo__asset_youtube_channel", value: 35000, currency: "INR", basis: "Fictional Q2 estimate", valuedAt: new Date("2026-06-15T00:00:00.000Z"), recordedBy: "demo__user_grace" },
    { id: "demo__val_youtube_2", assetId: "demo__asset_youtube_channel", value: 40000, currency: "INR", basis: "Current fictional estimate", valuedAt: D.now, recordedBy: "demo__user_grace" },
  ];
  for (const v of valuations) {
    const { id, ...data } = v;
    await prisma.valuation.upsert({
      where: { id },
      update: { ...data, isDemo: true },
      create: { id, ...data, isDemo: true },
    });
  }

  // --- Selling steps ---
  const steps: Array<{
    id: string;
    assetId: string;
    position: number;
    title: string;
    body: string;
    officialUrl?: string;
  }> = [
    // Steam
    { id: "demo__step_steam_1", assetId: "demo__asset_steam", position: 1, title: "Confirm account status", body: "Verify the account is in good standing and not limited.", officialUrl: "https://help.steampowered.com" },
    { id: "demo__step_steam_2", assetId: "demo__asset_steam", position: 2, title: "Understand the restriction", body: "Steam accounts and games cannot be sold or transferred under the Subscriber Agreement.", officialUrl: "https://store.steampowered.com/subscriber_agreement/" },
    { id: "demo__step_steam_3", assetId: "demo__asset_steam", position: 3, title: "Document library value", body: "Export a receipt list so the estate can record an estimated value." },
    // Coinbase
    { id: "demo__step_coinbase_1", assetId: "demo__asset_coinbase", position: 1, title: "Secure the account", body: "Nominee contacts Coinbase Support to begin the estate process.", officialUrl: "https://help.coinbase.com" },
    { id: "demo__step_coinbase_2", assetId: "demo__asset_coinbase", position: 2, title: "Prepare legal documents", body: "Gather death/legal documents required by Coinbase's estate policy." },
    { id: "demo__step_coinbase_3", assetId: "demo__asset_coinbase", position: 3, title: "Move to self-custody", body: "After verification, transfer crypto to a wallet controlled by the heir." },
    // GoDaddy domain
    { id: "demo__step_godaddy_1", assetId: "demo__asset_godaddy", position: 1, title: "Unlock the domain", body: "Disable the registrar lock in the domain settings.", officialUrl: "https://www.godaddy.com" },
    { id: "demo__step_godaddy_2", assetId: "demo__asset_godaddy", position: 2, title: "Obtain the auth code", body: "Request the authorization code from the registrar panel." },
    { id: "demo__step_godaddy_3", assetId: "demo__asset_godaddy", position: 3, title: "Transfer to new owner", body: "Nominee initiates a transfer at their own registrar using the auth code." },
    { id: "demo__step_godaddy_4", assetId: "demo__asset_godaddy", position: 4, title: "Confirm ICANN approval", body: "Both registrars confirm the transfer (usually 5–7 days)." },
    // Zerodha
    { id: "demo__step_zerodha_1", assetId: "demo__asset_zerodha", position: 1, title: "Nominee transmission", body: "Submit the legal heir/nominee claim with required documents to Zerodha.", officialUrl: "https://support.zerodha.com" },
    { id: "demo__step_zerodha_2", assetId: "demo__asset_zerodha", position: 2, title: "CDSL verification", body: "Depository verifies the claim against the demat nomination." },
    { id: "demo__step_zerodha_3", assetId: "demo__asset_zerodha", position: 3, title: "Holdings transferred", body: "Verified holdings move to the nominee's demat account." },
    // Google storage
    { id: "demo__step_google_1", assetId: "demo__asset_google_storage", position: 1, title: "Download archive", body: "Use Inactive Account Manager or Takeout to export data before closure.", officialUrl: "https://support.google.com/accounts/answer/157956" },
    { id: "demo__step_google_2", assetId: "demo__asset_google_storage", position: 2, title: "Cancel subscription", body: "Cancel Google One to stop renewal charges." },
    // YouTube
    { id: "demo__step_youtube_1", assetId: "demo__asset_youtube_channel", position: 1, title: "Review inheritance policy", body: "YouTube allows channel ownership transfer for estates.", officialUrl: "https://www.youtube.com/howyoutubeworks" },
    { id: "demo__step_youtube_2", assetId: "demo__asset_youtube_channel", position: 2, title: "Contact support", body: "Nominee contacts YouTube Support to begin heirship verification." },
    { id: "demo__step_youtube_3", assetId: "demo__asset_youtube_channel", position: 3, title: "Complete verification", body: "Provide the requested legal documents; ownership updates after review." },
  ];
  for (const s of steps) {
    await prisma.sellingStep.upsert({ where: { id: s.id }, update: s, create: s });
  }

  // --- Official links ---
  const links = [
    { id: "demo__link_steam_1", assetId: "demo__asset_steam", label: "Steam homepage", url: "https://store.steampowered.com", type: "OFFICIAL_SITE" as const },
    { id: "demo__link_steam_2", assetId: "demo__asset_steam", label: "Steam Support", url: "https://help.steampowered.com", type: "SUPPORT" as const },
    { id: "demo__link_steam_3", assetId: "demo__asset_steam", label: "Subscriber Agreement", url: "https://store.steampowered.com/subscriber_agreement/", type: "SELLING_POLICY" as const },
    { id: "demo__link_coinbase_1", assetId: "demo__asset_coinbase", label: "Coinbase homepage", url: "https://www.coinbase.com", type: "OFFICIAL_SITE" as const },
    { id: "demo__link_coinbase_2", assetId: "demo__asset_coinbase", label: "Coinbase Help", url: "https://help.coinbase.com", type: "HELP_CENTER" as const },
    { id: "demo__link_godaddy_1", assetId: "demo__asset_godaddy", label: "GoDaddy homepage", url: "https://www.godaddy.com", type: "OFFICIAL_SITE" as const },
    { id: "demo__link_godaddy_2", assetId: "demo__asset_godaddy", label: "Domain transfer help", url: "https://www.godaddy.com/help/transfer-a-domain-to-godaddy-411", type: "TRANSFER_POLICY" as const },
    { id: "demo__link_zerodha_1", assetId: "demo__asset_zerodha", label: "Zerodha homepage", url: "https://www.zerodha.com", type: "OFFICIAL_SITE" as const },
    { id: "demo__link_zerodha_2", assetId: "demo__asset_zerodha", label: "Zerodha support", url: "https://support.zerodha.com", type: "SUPPORT" as const },
    { id: "demo__link_google_1", assetId: "demo__asset_google_storage", label: "Google Inactive Account Manager", url: "https://support.google.com/accounts/answer/157956", type: "RECOVERY" as const },
    { id: "demo__link_youtube_1", assetId: "demo__asset_youtube_channel", label: "How YouTube Works", url: "https://www.youtube.com/howyoutubeworks", type: "OFFICIAL_SITE" as const },
    { id: "demo__link_canva_1", assetId: "demo__asset_canva_usd", label: "Canva homepage", url: "https://www.canva.com", type: "OFFICIAL_SITE" as const },
  ];
  for (const l of links) {
    await prisma.officialLink.upsert({ where: { id: l.id }, update: l, create: l });
  }

  // --- Nominees ---
  const nominees = [
    { id: "demo__nominee_ada_maya", ownerId: "demo__user_ada", name: "Maya Nominee", email: "maya@demo.local", relationship: "Sibling", isDemo: true },
    { id: "demo__nominee_grace_maya", ownerId: "demo__user_grace", name: "Maya Nominee", email: "maya@demo.local", relationship: "Friend", isDemo: true },
  ];
  for (const n of nominees) {
    await prisma.nominee.upsert({ where: { id: n.id }, update: n, create: n });
  }

  // --- Asset authorizations ---
  const auths = [
    { id: "demo__auth_steam_maya", assetId: "demo__asset_steam", nomineeId: "demo__nominee_ada_maya", grantedBy: "demo__user_ada", status: "ACTIVE" as const, isDemo: true },
    { id: "demo__auth_coinbase_maya", assetId: "demo__asset_coinbase", nomineeId: "demo__nominee_ada_maya", grantedBy: "demo__user_ada", status: "ACTIVE" as const, isDemo: true },
    { id: "demo__auth_zerodha_maya", assetId: "demo__asset_zerodha", nomineeId: "demo__nominee_ada_maya", grantedBy: "demo__user_ada", status: "REVOKED" as const, revokedAt: D.now, isDemo: true },
    { id: "demo__auth_youtube_maya", assetId: "demo__asset_youtube_channel", nomineeId: "demo__nominee_grace_maya", grantedBy: "demo__user_grace", status: "ACTIVE" as const, isDemo: true },
  ];
  for (const a of auths) {
    await prisma.assetAuthorization.upsert({ where: { id: a.id }, update: a, create: a });
  }

  // --- Inheritance requests (one per asset/nominee pair, various states) ---
  const requests = [
    {
      id: "demo__req_steam_maya",
      assetId: "demo__asset_steam",
      nomineeId: "demo__nominee_ada_maya",
      invitedById: "demo__user_ada",
      status: "INVITED" as const,
      invitedAt: D.invitedAt,
      graceEndsAt: D.graceEndsAt,
      isDemo: true,
    },
    {
      id: "demo__req_coinbase_maya",
      assetId: "demo__asset_coinbase",
      nomineeId: "demo__nominee_ada_maya",
      invitedById: "demo__user_ada",
      status: "ELIGIBLE" as const,
      invitedAt: D.invitedAt,
      graceEndsAt: D.graceEndsAt,
      eligibleAt: D.eligibleAt,
      isDemo: true,
    },
    {
      id: "demo__req_zerodha_maya",
      assetId: "demo__asset_zerodha",
      nomineeId: "demo__nominee_ada_maya",
      invitedById: "demo__user_ada",
      status: "CLAIMED_PENDING_CONFIRM" as const,
      invitedAt: D.invitedAt,
      graceEndsAt: D.graceEndsAt,
      eligibleAt: D.eligibleAt,
      claimedAt: D.claimedAt,
      isDemo: true,
    },
    {
      id: "demo__req_youtube_maya",
      assetId: "demo__asset_youtube_channel",
      nomineeId: "demo__nominee_grace_maya",
      invitedById: "demo__user_grace",
      status: "RELEASED" as const,
      invitedAt: D.invitedAt,
      graceEndsAt: D.graceEndsAt,
      eligibleAt: D.eligibleAt,
      claimedAt: D.claimedAt,
      releasedAt: D.releasedAt,
      isDemo: true,
    },
    {
      id: "demo__req_google_maya",
      assetId: "demo__asset_google_storage",
      nomineeId: "demo__nominee_ada_maya",
      invitedById: "demo__user_ada",
      status: "REVOKED" as const,
      invitedAt: D.invitedAt,
      graceEndsAt: D.graceEndsAt,
      isDemo: true,
    },
    {
      id: "demo__req_canva_maya",
      assetId: "demo__asset_canva_usd",
      nomineeId: "demo__nominee_ada_maya",
      invitedById: "demo__user_ada",
      status: "EXPIRED" as const,
      invitedAt: D.invitedAt,
      graceEndsAt: D.graceEndsAt,
      isDemo: true,
    },
  ];
  for (const r of requests) {
    await prisma.inheritanceRequest.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // --- Inheritance events (audit trail) ---
  const events = [
    { id: "demo__evt_steam_invited", requestId: "demo__req_steam_maya", actorId: "demo__user_ada", action: "INVITED" as const, note: "Nominee invited via email (simulated).", createdAt: D.invitedAt },
    { id: "demo__evt_coinbase_invited", requestId: "demo__req_coinbase_maya", actorId: "demo__user_ada", action: "INVITED" as const, note: "Nominee invited via email (simulated).", createdAt: D.invitedAt },
    { id: "demo__evt_coinbase_eligible", requestId: "demo__req_coinbase_maya", actorId: null, action: "ELIGIBILITY_MET" as const, note: "Grace period elapsed; owner remains inactive. Access NOT granted — nominee must verify identity.", createdAt: D.eligibleAt },
    { id: "demo__evt_zerodha_invited", requestId: "demo__req_zerodha_maya", actorId: "demo__user_ada", action: "INVITED" as const, note: "Nominee invited via email (simulated).", createdAt: D.invitedAt },
    { id: "demo__evt_zerodha_eligible", requestId: "demo__req_zerodha_maya", actorId: null, action: "ELIGIBILITY_MET" as const, note: "Grace period elapsed; owner remains inactive.", createdAt: D.eligibleAt },
    { id: "demo__evt_zerodha_claim", requestId: "demo__req_zerodha_maya", actorId: "demo__user_nominee_maya", action: "CLAIM_STARTED" as const, note: "Nominee started the claim; awaiting identity reconfirmation.", createdAt: D.claimedAt },
    { id: "demo__evt_youtube_invited", requestId: "demo__req_youtube_maya", actorId: "demo__user_grace", action: "INVITED" as const, note: "Nominee invited via email (simulated).", createdAt: D.invitedAt },
    { id: "demo__evt_youtube_eligible", requestId: "demo__req_youtube_maya", actorId: null, action: "ELIGIBILITY_MET" as const, note: "Grace period elapsed; owner remains inactive.", createdAt: D.eligibleAt },
    { id: "demo__evt_youtube_claim", requestId: "demo__req_youtube_maya", actorId: "demo__user_nominee_maya", action: "CLAIM_STARTED" as const, note: "Nominee started the claim.", createdAt: D.claimedAt },
    { id: "demo__evt_youtube_confirm", requestId: "demo__req_youtube_maya", actorId: "demo__user_nominee_maya", action: "IDENTITY_RECONFIRMED" as const, note: "Nominee re-authenticated and acknowledged that inactivity is not confirmation of death.", createdAt: D.claimedAt },
    { id: "demo__evt_youtube_released", requestId: "demo__req_youtube_maya", actorId: null, action: "RELEASED" as const, note: "Simulated release of guidance-only access.", createdAt: D.releasedAt },
    { id: "demo__evt_google_invited", requestId: "demo__req_google_maya", actorId: "demo__user_ada", action: "INVITED" as const, note: "Nominee invited via email (simulated).", createdAt: D.invitedAt },
    { id: "demo__evt_google_revoked", requestId: "demo__req_google_maya", actorId: "demo__user_ada", action: "REVOKED" as const, note: "Owner revoked the request while still in control.", createdAt: D.now },
    { id: "demo__evt_canva_invited", requestId: "demo__req_canva_maya", actorId: "demo__user_ada", action: "INVITED" as const, note: "Nominee invited via email (simulated).", createdAt: D.invitedAt },
    { id: "demo__evt_canva_expired", requestId: "demo__req_canva_maya", actorId: null, action: "EXPIRED" as const, note: "Nominee did not respond within the grace window; no access was granted.", createdAt: D.graceEndsAt },
  ];
  for (const e of events) {
    await prisma.inheritanceEvent.upsert({ where: { id: e.id }, update: e, create: e });
  }

  // --- Notifications ---
  const notifications = [
    { id: "demo__notif_ada_inactivity", userId: "demo__user_ada", type: "INACTIVITY_WARNING" as const, title: "Vault check-in reminder", body: "Your vault has been quiet for 30 days. Sign in to confirm your records are current.", createdAt: D.now, isDemo: true },
    { id: "demo__notif_grace_inactivity", userId: "demo__user_grace", type: "INACTIVITY_WARNING" as const, title: "Vault check-in reminder", body: "Your vault has been quiet for 30 days. Sign in to confirm your records are current.", createdAt: D.now, isDemo: true },
    { id: "demo__notif_maya_invite_youtube", userId: "demo__user_nominee_maya", type: "NOMINEE_INVITE" as const, title: "New inheritance invitation", body: "You have been named a nominee for YouTube Channel: GraceCodes.", createdAt: D.invitedAt, isDemo: true },
    { id: "demo__notif_maya_released_youtube", userId: "demo__user_nominee_maya", type: "ACCESS_RELEASED" as const, title: "Simulated access released", body: "Guidance-only access to YouTube Channel: GraceCodes has been released after verification.", createdAt: D.releasedAt, isDemo: true },
  ];
  for (const n of notifications) {
    await prisma.notification.upsert({ where: { id: n.id }, update: n, create: n });
  }

  console.log("[seed] Demo data seeded successfully.");
  console.log("[seed] Demo login credentials (disposable, fictional):");
  console.log("[seed]   Owner:        ada@demo.local / DemoPass123!");
  console.log("[seed]   Owner:        grace@demo.local / DemoPass123!");
  console.log("[seed]   Nominee:      maya@demo.local / DemoPass123!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[seed] Failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
