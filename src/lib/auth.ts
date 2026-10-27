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
    enabled: false,
    minPasswordLength: 8,
  },
  emailVerification: {
    sendOnSignUp: false,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async () => {},
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
  user: {
    // Expose the existing lastSeenAt column through Better Auth's session
    // user object. Without this declaration the dashboard can never see a
    // fresh check-in: the column exists in the DB but is omitted from the
    // projected session user, so "Keep it active" always showed "Never
    // checked in" even right after a confirmed, persisted check-in.
    // input: false — no client endpoint can set it; only the server-side
    // /api/check-in route writes it.
    additionalFields: {
      lastSeenAt: {
        type: "date",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies(), verificationResendPlugin()],
});

export type Session = typeof auth.$Infer.Session;
