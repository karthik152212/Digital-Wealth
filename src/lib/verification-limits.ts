/**
 * Server-enforced verification resend limits.
 *
 * All state lives in the shared `RateLimit` table (PostgreSQL), never in
 * process memory, so the limits hold across multiple app instances. Better
 * Auth's own rate limiter is configured with `storage: "database"` against
 * the same table (IP-based limits on its endpoints); the per-email cooldown
 * below is enforced here with an atomic compare-and-swap, which also makes
 * concurrent resend attempts result in exactly one outbound send.
 *
 * Limits are configurable via environment variables (see .env.example).
 */

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

function envInt(name: string, fallback: number, min: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

/** Seconds a given email must wait between verification sends. */
export function resendCooldownSeconds(): number {
  return envInt("VERIFICATION_RESEND_COOLDOWN_SECONDS", 60, 0);
}

/** Per-IP resend limits for Better Auth's resend endpoints (shared store). */
export function resendIpWindowSeconds(): number {
  return envInt("VERIFICATION_RESEND_IP_WINDOW_SECONDS", 60, 1);
}
export function resendIpMax(): number {
  return envInt("VERIFICATION_RESEND_IP_MAX", 6, 1);
}

/** Per-IP limits for verification-link attempts (anti-brute-force). */
export function attemptsIpWindowSeconds(): number {
  return envInt("VERIFICATION_ATTEMPTS_IP_WINDOW_SECONDS", 60, 1);
}
export function attemptsIpMax(): number {
  return envInt("VERIFICATION_ATTEMPTS_IP_MAX", 10, 1);
}

function cooldownKey(email: string): string {
  return `verification-resend:${email}`;
}

export type CooldownClaim =
  | { claimed: true }
  | { claimed: false; retryAfterSeconds: number };

/**
 * Atomically claim the resend slot for an email.
 *
 * Uses `INSERT ... ON CONFLICT ... WHERE` so that of N concurrent requests
 * (across any number of instances) exactly one claim succeeds; the rest are
 * rejected with the remaining cooldown. Returns `claimed: false` whenever a
 * send happened for this email less than the cooldown ago — including for
 * emails that do not exist, so responses do not reveal account state.
 */
export async function claimResendCooldown(email: string): Promise<CooldownClaim> {
  const key = cooldownKey(email);
  const now = Date.now();
  const cooldownMs = BigInt(resendCooldownSeconds() * 1000);
  // Single BigInt parameter: the pg driver adapter cannot infer types for
  // an inline bigint subtraction ("unknown - unknown").
  const threshold = BigInt(now) - cooldownMs;

  const rows = await prisma.$queryRaw<Array<{ lastRequest: bigint }>>`
    INSERT INTO "RateLimit" (id, key, count, "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT (key) DO UPDATE
      SET count = "RateLimit".count + 1,
          "lastRequest" = EXCLUDED."lastRequest"
      WHERE "RateLimit"."lastRequest" <= ${threshold}
    RETURNING "lastRequest"
  `;

  if (rows.length > 0) {
    return { claimed: true };
  }

  // Conflict: a send was already claimed within the cooldown window.
  const existing = await prisma.rateLimit.findUnique({ where: { key } });
  const retryAfterSeconds = existing
    ? Math.max(
        1,
        Math.ceil(
          (Number(existing.lastRequest) + Number(cooldownMs) - now) / 1000,
        ),
      )
    : resendCooldownSeconds();
  return { claimed: false, retryAfterSeconds };
}
