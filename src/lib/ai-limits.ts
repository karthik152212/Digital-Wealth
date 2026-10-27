/**
 * Per-user rate limiting for the AI endpoints.
 *
 * State lives in the shared `RateLimit` table (PostgreSQL), the same store
 * Better Auth and the verification resend cooldown use, so limits hold across
 * every app instance and survive restarts. Nothing is kept in process memory.
 *
 * Each key is namespaced (`ai-chat:<userId>`, …) and stores a fixed window
 * that starts when the first request of the window arrives: `lastRequest` is
 * the window start for these keys, `count` the number of requests inside it.
 */

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

function envInt(name: string, fallback: number, min: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

/** Chat: messages a single user may send per window. */
export function chatRateMax(): number {
  return envInt("AI_CHAT_RATE_MAX", 10, 1);
}
export function chatRateWindowSeconds(): number {
  return envInt("AI_CHAT_RATE_WINDOW_SECONDS", 60, 1);
}

/** Insight generation: provider calls per window (server-side cache misses). */
export function insightRateMax(): number {
  return envInt("AI_INSIGHTS_RATE_MAX", 8, 1);
}
export function insightRateWindowSeconds(): number {
  return envInt("AI_INSIGHTS_RATE_WINDOW_SECONDS", 3600, 1);
}

/** Manual "refresh now" clicks: must additionally stay inside this budget. */
export function insightRefreshMax(): number {
  return envInt("AI_INSIGHTS_REFRESH_MAX", 4, 1);
}
export function insightRefreshWindowSeconds(): number {
  return envInt("AI_INSIGHTS_REFRESH_WINDOW_SECONDS", 600, 1);
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Atomically consume one unit of a fixed-window, per-user quota.
 *
 * The whole increment happens in a single `INSERT … ON CONFLICT` statement,
 * so N concurrent requests (across any number of instances) can never all
 * observe the same pre-increment count and slip past the limit.
 */
export async function consumeRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = BigInt(Date.now());
  const windowMs = BigInt(windowSeconds * 1000);
  const threshold = now - windowMs;

  const rows = await prisma.$queryRaw<
    Array<{ count: number; lastRequest: bigint }>
  >`
    INSERT INTO "RateLimit" (id, key, count, "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE
      SET count = CASE
            WHEN "RateLimit"."lastRequest" <= ${threshold} THEN 1
            ELSE "RateLimit".count + 1
          END,
          "lastRequest" = CASE
            WHEN "RateLimit"."lastRequest" <= ${threshold} THEN ${now}
            ELSE "RateLimit"."lastRequest"
          END
    RETURNING count, "lastRequest"
  `;

  const row = rows[0];
  if (!row) {
    return { allowed: true, remaining: Math.max(0, max - 1), retryAfterSeconds: 0 };
  }

  const count = Number(row.count);
  const windowStart = Number(row.lastRequest);
  const retryAfterSeconds =
    count > max
      ? Math.max(1, Math.ceil((windowStart + Number(windowMs) - Number(now)) / 1000))
      : 0;

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    retryAfterSeconds,
  };
}
