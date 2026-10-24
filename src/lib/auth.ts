import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { deliverVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  attemptsIpMax,
  attemptsIpWindowSeconds,
  claimResendCooldown,
  resendIpMax,
  resendIpWindowSeconds,
} from "@/lib/verification-limits";
import { verificationResendPlugin } from "@/lib/verification-plugin";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || undefined;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined;

export const isGoogleConfigured = Boolean(
  googleClientId && googleClientSecret,
);

export const auth = betterAuth({
  appName: "Digital Wealth Vault",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Blocks sign-in for unverified accounts (Better Auth returns
    // EMAIL_NOT_VERIFIED) and makes duplicate sign-ups return a generic
    // response so registration cannot be used to enumerate accounts.
    // Note: with this enabled, Better Auth skips auto-sign-in after
    // sign-up — the UI routes new users to the verification flow instead.
    requireEmailVerification: true,
  },
  emailVerification: {
    // requireEmailVerification already implies sendOnSignUp; set explicitly
    // so the behavior is visible in this config.
    sendOnSignUp: true,
    // Verification links are stateless, signed JWTs (HS256 with
    // BETTER_AUTH_SECRET). 24h is a deliberate prototype-friendly expiry.
    expiresIn: 60 * 60 * 24,
    // Every send (sign-up and Better Auth's built-in resend endpoint) claims
    // the shared per-email cooldown first. On conflict the send is skipped
    // silently so sign-up can never fail and no path can flood an inbox.
    // The UI's /api/auth/resend-verification endpoint performs the same
    // claim up front and surfaces an honest 429 + Retry-After instead.
    sendVerificationEmail: async ({ user, token }) => {
      const claim = await claimResendCooldown(user.email);
      if (!claim.claimed) return;
      await deliverVerificationEmail({ user, token });
    },
  },
  rateLimit: {
    // Enabled in every environment (default is production-only).
    // "database" stores counters in the shared RateLimit table, so limits
    // hold across multiple app instances — never process-local memory.
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      // Generous ceilings so the demo and test suite are not throttled.
      "/sign-in/email": { window: 10, max: 20 },
      "/sign-up/email": { window: 10, max: 20 },
      // Verification resends and link attempts are throttled per IP from
      // env-configurable values (see .env.example).
      "/send-verification-email": {
        window: resendIpWindowSeconds(),
        max: resendIpMax(),
      },
      "/verify-email": {
        window: attemptsIpWindowSeconds(),
        max: attemptsIpMax(),
      },
    },
  },
  socialProviders: isGoogleConfigured
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies(), verificationResendPlugin()],
});

export type Session = typeof auth.$Infer.Session;
