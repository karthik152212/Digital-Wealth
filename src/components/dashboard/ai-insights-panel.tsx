"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Info,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Insight = {
  id: string;
  kind: "observation" | "suggestion";
  title: string;
  detail: string;
  nextStep: string;
  scope: { type: string; label?: string } | null;
  source: "ai" | "rules";
};

type InsightsResponse = {
  insights: Insight[];
  source: "ai" | "rules";
  generatedAt: string;
  cached: boolean;
  stale: boolean;
  portfolioAsOf: string;
  ai: {
    configured: boolean;
    model: string;
    setupHint: string | null;
    unavailableReason: string | null;
  };
};

const UNAVAILABLE_COPY: Record<string, string> = {
  not_configured:
    "The AI provider is not configured (GEMINI_API_KEY is missing), so you are seeing rule-based insights computed from your data.",
  rate_limited:
    "The AI generation budget for this account is spent for now, so you are seeing the current cached or rule-based insights.",
  provider_error:
    "The AI provider could not be reached, so you are seeing rule-based insights computed from your data.",
  invalid_response:
    "The AI provider returned an unexpected response, so you are seeing rule-based insights computed from your data.",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const diff = Date.now() - then;
  if (diff < 45_000) return "just now";
  if (diff < 60_000) return "under a minute ago";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(then).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function fetchInsights(): Promise<InsightsResponse> {
  const res = await fetch("/api/ai/insights", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not load insights.");
  }
  return (await res.json()) as InsightsResponse;
}

export function AiInsightsPanel() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const body = await fetchInsights();
      if (mounted.current) setData(body);
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Could not load insights.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // State is applied from promise callbacks rather than the effect body, so
    // the first paint stays the skeleton instead of cascading re-renders.
    fetchInsights()
      .then((body) => {
        if (mounted.current) setData(body);
      })
      .catch((cause: unknown) => {
        if (mounted.current) {
          setError(
            cause instanceof Error ? cause.message : "Could not load insights.",
          );
        }
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/insights", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          retryAfterSeconds?: number;
        } | null;
        throw new Error(
          body?.error ??
            (body?.retryAfterSeconds
              ? `Try again in ${body.retryAfterSeconds}s.`
              : "Refresh failed."),
        );
      }
      setData((await res.json()) as InsightsResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  const unavailable =
    data?.ai.unavailableReason != null
      ? UNAVAILABLE_COPY[data.ai.unavailableReason] ?? null
      : null;

  return (
    <section aria-label="AI wealth insights">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" aria-hidden />
              AI Wealth Insights
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Personalised observations and suggestions drawn from your saved
              records — not financial advice.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!loading && data && (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <Clock className="size-3.5" aria-hidden />
                {data.source === "ai" ? "Generated" : "Computed"}{" "}
                {relativeTime(data.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertTitle>Insights unavailable</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    void load();
                  }}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {unavailable && !error && (
            <Alert>
              <Info className="size-4" aria-hidden />
              <AlertTitle>Fallback mode</AlertTitle>
              <AlertDescription>{unavailable}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((index) => (
                <div key={index} className="rounded-xl border p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-4/5" />
                </div>
              ))}
            </div>
          ) : data && data.insights.length > 0 ? (
            <ul className="space-y-3">
              {data.insights.map((insight) => (
                <li
                  key={insight.id}
                  className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        insight.kind === "observation"
                          ? "bg-accent text-accent-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                      aria-hidden
                    >
                      {insight.kind === "observation" ? (
                        <Info className="size-4" />
                      ) : (
                        <Lightbulb className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium leading-snug">{insight.title}</p>
                        <Badge
                          variant={insight.kind === "observation" ? "secondary" : "outline"}
                          className="shrink-0"
                        >
                          {insight.kind === "observation" ? "Observation" : "Suggestion"}
                        </Badge>
                        {data.source === "rules" && (
                          <Badge variant="outline" className="shrink-0 text-muted-foreground">
                            Rule-based
                          </Badge>
                        )}
                        {insight.scope?.label && insight.scope.type !== "portfolio" && (
                          <Badge variant="outline" className="shrink-0">
                            {insight.scope.label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{insight.detail}</p>
                      <p className="mt-2 flex items-start gap-1.5 text-sm">
                        <ArrowRight
                          className="mt-0.5 size-3.5 shrink-0 text-primary"
                          aria-hidden
                        />
                        <span>{insight.nextStep}</span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              No insights yet — add an asset and its valuation and suggestions
              will appear here.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {data && data.stale
              ? "Showing the last successfully generated insights; a newer generation failed."
              : data?.cached
                ? "Insights are cached and regenerated periodically or when your portfolio changes."
                : null}
            {data?.source === "ai" && data.ai.model
              ? ` Generated with ${data.ai.model} from your saved vault data.`
              : ""}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
