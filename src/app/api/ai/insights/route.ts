import { requireVerifiedApiSession } from "@/lib/session";
import { getPortfolioSnapshot } from "@/lib/portfolio";
import { getInsights, type InsightsResult } from "@/lib/ai-insights";
import {
  consumeRateLimit,
  insightRefreshMax,
  insightRefreshWindowSeconds,
} from "@/lib/ai-limits";

/**
 * GET  /api/ai/insights — portfolio insights, generated only when the cache
 *                         is missing, stale, or the portfolio changed.
 * POST /api/ai/insights — explicit "refresh now", rate limited per user.
 *
 * Both are authenticated server-side; the user id comes from the session and
 * every query is scoped to it, so a client cannot request another user's data.
 */
export async function GET(request: Request) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const userId = guard.session.user.id;

  const snapshot = await getPortfolioSnapshot(userId);
  const result = await getInsights(userId, snapshot);

  return Response.json(payload(result, snapshot.generatedAt));
}

export async function POST(request: Request) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const userId = guard.session.user.id;

  const budget = await consumeRateLimit(
    `ai-insights-refresh:${userId}`,
    insightRefreshMax(),
    insightRefreshWindowSeconds(),
  );
  if (!budget.allowed) {
    return Response.json(
      {
        error: "Refresh limit reached. Please wait before refreshing again.",
        retryAfterSeconds: budget.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(budget.retryAfterSeconds) },
      },
    );
  }

  const snapshot = await getPortfolioSnapshot(userId);
  const result = await getInsights(userId, snapshot, { force: true });

  return Response.json(payload(result, snapshot.generatedAt));
}

function payload(result: InsightsResult, portfolioAsOf: string) {
  return {
    insights: result.insights,
    source: result.source,
    generatedAt: result.generatedAt,
    cached: result.cached,
    stale: result.stale,
    ai: result.ai,
    portfolioAsOf,
  };
}
