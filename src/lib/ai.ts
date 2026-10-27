/**
 * Centralised Google Gemini (Gen AI) integration.
 *
 * Rules enforced here:
 *  - Server-only: this module refuses to run in a browser bundle, and the
 *    key is read from the server-side `GEMINI_API_KEY` variable only
 *    (never `NEXT_PUBLIC_*`, never committed, never returned to a client).
 *  - Every request has a timeout and a bounded output size.
 *  - Rate limits, quota exhaustion, network failures, invalid responses and
 *    missing keys are turned into typed, retryable/non-retryable errors so
 *    callers can degrade gracefully instead of crashing.
 */

import type { ZodType } from "zod";

/**
 * The current official Node SDK for the Gemini API. Installed as a direct
 * dependency; the older `@google/generative-ai` package is deprecated and is
 * deliberately not used.
 */

/**
 * Default model, verified against the live API for this project.
 *
 * This used to be `gemini-2.5-flash`, which Google now answers with HTTP 404
 * NOT_FOUND ("This model ... is no longer available to new users"). Because a
 * 404 fell through to a generic provider error, every request silently
 * degraded to the rule-based fallback / 502 chat response. Keep this on a
 * model that is actually served, and always go through `modelCandidates()` so
 * a retired model degrades to the next candidate instead of to no AI at all.
 */
const DEFAULT_MODEL = "gemini-3.5-flash";

/** Tried after `aiModel()` whenever the configured model cannot serve a call. */
const FALLBACK_MODELS: readonly string[] = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  // Free-tier quota is tracked per model (20 requests/day for new keys), so a
  // separate model keeps the feature alive when the flash bucket is spent.
  "gemini-flash-lite-latest",
];

export type AiErrorCode =
  | "not_configured"
  | "provider_auth"
  | "rate_limited"
  | "model_unavailable"
  | "invalid_request"
  | "timeout"
  | "network"
  | "invalid_response"
  | "blocked"
  | "provider_error";

const RETRYABLE: ReadonlySet<AiErrorCode> = new Set([
  "rate_limited",
  "timeout",
  "network",
  "provider_error",
]);

/*
 * `model_unavailable` and `invalid_request` are deliberately NOT retryable:
 * repeating the identical request cannot fix a retired model or a rejected
 * payload. They only trigger a switch to the next candidate model.
 */

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
  }
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function aiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Ordered, de-duplicated models to try: the configured one, then fallbacks. */
export function modelCandidates(): string[] {
  return [...new Set([aiModel(), ...FALLBACK_MODELS])];
}

export function aiTimeoutMs(): number {
  return envInt("GEMINI_TIMEOUT_MS", 20_000, 1_000, 60_000);
}

/** Server-side API key. Never expose this value to client code. */
function apiKey(): string | null {
  if (typeof window !== "undefined") {
    throw new AiError("not_configured", "AI must only run on the server.");
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

export function isAiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key);
}

export type AiStatus = {
  configured: boolean;
  model: string;
  /** Human-readable setup hint when not configured. */
  setupHint: string | null;
};

export function aiStatus(): AiStatus {
  const configured = isAiConfigured();
  return {
    configured,
    model: aiModel(),
    setupHint: configured
      ? null
      : "Add GEMINI_API_KEY to the server environment (see .env.example) to enable AI insights and chat.",
  };
}

type RawError = {
  status?: number;
  message?: string;
  error?: { status?: number; message?: string };
};

/**
 * Turns anything the SDK throws into a typed `AiError`.
 *
 * Exported for regression tests: the exact shape Google returns for a retired
 * model (HTTP 404 + `{"status":"NOT_FOUND"}`) must classify as
 * `model_unavailable`, not as an opaque provider error.
 */
export function classifyAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const raw = (error ?? {}) as RawError;
  const message = raw.message ?? (error instanceof Error ? error.message : String(error));
  const status = raw.status ?? raw.error?.status;
  const lower = message.toLowerCase();

  if (/timed? ?out|timeout|abort/i.test(lower)) {
    return new AiError("timeout", "The AI provider timed out.");
  }
  if (
    status === 429 ||
    /rate limit|quota|resource_exhausted|resource exhausted|too many requests/.test(lower)
  ) {
    return new AiError("rate_limited", "The AI provider is rate limited or out of quota.");
  }
  if (
    status === 401 ||
    status === 403 ||
    /api key|api_key|permission denied|unauthorized|unauthenticated|invalid key/.test(lower)
  ) {
    return new AiError("provider_auth", "The AI provider rejected the configured credentials.");
  }
  if (
    status === 404 ||
    /no longer available|not_found|not found for api key|does not have access/.test(lower)
  ) {
    // Model retired, misnamed, or not enabled for this key/project.
    return new AiError(
      "model_unavailable",
      `The configured AI model is not available to this API key: ${message}`,
    );
  }
  if (/safety|blocked|prohibited|content policy|finishreason/.test(lower)) {
    return new AiError("blocked", "The AI provider blocked this request.");
  }
  if (status === 400) {
    // Rejected request body (e.g. thinkingConfig on a non-thinking model).
    return new AiError("invalid_request", `The AI provider rejected the request: ${message}`);
  }
  if (
    /fetch failed|network|econnrefused|enotfound|econnreset|socket|getaddrinfo|unable to connect|eai_again/i.test(
      lower,
    )
  ) {
    return new AiError("network", "Could not reach the AI provider.");
  }
  if (status && status >= 500) {
    return new AiError("provider_error", "The AI provider is unavailable.");
  }
  return new AiError("provider_error", `Unexpected AI provider error: ${message}`);
}

type Client = {
  models: {
    generateContent: (params: {
      model: string;
      contents: unknown;
      config?: Record<string, unknown>;
    }) => Promise<{ text?: string; candidates?: unknown[] }>;
  };
};

async function loadClient(timeoutMs: number): Promise<Client> {
  const key = apiKey();
  if (!key) {
    throw new AiError(
      "not_configured",
      "GEMINI_API_KEY is not set on the server. Add it to enable AI features.",
    );
  }
  // Dynamic import keeps the SDK out of any client bundle.
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { timeout: timeoutMs },
  }) as unknown as Client;
}

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateTextParams = {
  system: string;
  /** Single-shot prompt. Ignored when `turns` is provided. */
  prompt?: string;
  /** Multi-turn conversation (client-held history plus the latest message). */
  turns?: ChatTurn[];
  /** Hard cap on returned tokens; keeps cost and latency bounded. */
  maxOutputTokens?: number;
  temperature?: number;
  thinkingBudget?: number;
  timeoutMs?: number;
};

function contentsOf(params: GenerateTextParams): unknown {
  if (params.turns && params.turns.length > 0) {
    return params.turns.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    }));
  }
  if (params.prompt && params.prompt.length > 0) return params.prompt;
  throw new AiError("invalid_response", "No prompt was supplied to the AI provider.");
}

function textOf(response: { text?: string; candidates?: unknown[] }): string {
  const text = response.text;
  if (typeof text === "string" && text.trim().length > 0) return text.trim();
  const candidates = response.candidates ?? [];
  if (candidates.length === 0) {
    throw new AiError("invalid_response", "The AI provider returned no content.");
  }
  throw new AiError("invalid_response", "The AI provider returned an empty response.");
}

type OutputMode = "text" | "json";

type Attempt = { model: string; withThinking: boolean };

/**
 * One attempt per candidate model, each with the requested thinking budget and
 * then without it: models without a thinking mode reject `thinkingConfig` with
 * HTTP 400 INVALID_ARGUMENT, so the budget must never be able to fail a call.
 */
function attemptPlan(): Attempt[] {
  const plan: Attempt[] = [];
  for (const model of modelCandidates()) {
    plan.push({ model, withThinking: true });
    plan.push({ model, withThinking: false });
  }
  return plan;
}

function buildConfig(
  params: GenerateTextParams,
  mode: OutputMode,
  withThinking: boolean,
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    systemInstruction: params.system,
    temperature: params.temperature ?? (mode === "json" ? 0.5 : 0.4),
    maxOutputTokens: params.maxOutputTokens ?? (mode === "json" ? 1600 : 1024),
    // Both callers rely on this: the JSON path must not be prose-wrapped and
    // the chat path must never leak thoughts into the reply.
    responseMimeType: mode === "json" ? "application/json" : "text/plain",
  };
  if (withThinking) {
    // NOTE: the SDK only honours `thinkingBudget` inside `thinkingConfig`;
    // passing it at the top level of `config` is silently dropped.
    config.thinkingConfig = {
      thinkingBudget: params.thinkingBudget ?? (mode === "json" ? 512 : 0),
    };
  }
  return config;
}

/**
 * Runs `generateContent`, walking the attempt plan until a candidate answers.
 *
 * A retired or misconfigured model (404), a rejected payload (400), an
 * exhausted per-model quota (429), a malformed/unusable reply and a transient
 * provider failure (5xx) all move on to the next candidate; auth, timeout,
 * network and safety failures stop immediately because no other model would
 * behave differently.
 */
async function generateResponse(
  params: GenerateTextParams,
  mode: OutputMode,
): Promise<{ response: { text?: string; candidates?: unknown[] }; model: string }> {
  const timeoutMs = params.timeoutMs ?? aiTimeoutMs();
  const client = await loadClient(timeoutMs);
  const contents = contentsOf(params);
  const plan = attemptPlan();
  let lastError: AiError | null = null;

  for (let index = 0; index < plan.length; index += 1) {
    const attempt = plan[index];
    try {
      const response = await client.models.generateContent({
        model: attempt.model,
        contents,
        config: buildConfig(params, mode, attempt.withThinking),
      });
      return { response, model: attempt.model };
    } catch (error) {
      const aiError = classifyAiError(error);
      lastError = aiError;

      if (attempt.withThinking && aiError.code === "invalid_request") {
        // Likely `thinkingConfig` on a model that does not support it: retry
        // this same model with the plain config before moving on.
        continue;
      }
      const canTryAnotherModel =
        aiError.code === "model_unavailable" ||
        aiError.code === "invalid_request" ||
        aiError.code === "invalid_response" ||
        aiError.code === "provider_error" ||
        // Only the provider can raise this here: callers apply the app's own
        // rate limits *before* reaching this layer. Free-tier quota is per
        // model, so exhausting one model's bucket is a reason to try the next
        // one, not to fail the whole call while another model still has room.
        aiError.code === "rate_limited";
      if (!canTryAnotherModel) throw aiError;
      if (attempt.withThinking) {
        // The model itself is the problem: skip its duplicate no-thinking try.
        while (index + 1 < plan.length && plan[index + 1].model === attempt.model) {
          index += 1;
        }
      }
    }
  }

  throw lastError ?? new AiError("provider_error", "The AI provider returned no response.");
}

export type AiTextResult = { text: string; model: string };

/** Generates a single reply and reports which model actually produced it. */
export async function generateAiText(params: GenerateTextParams): Promise<AiTextResult> {
  const { response, model } = await generateResponse(params, "text");
  return { text: textOf(response), model };
}

/**
 * Requests JSON output and validates it with the caller's schema. Anything
 * malformed (bad JSON, wrong shape, out-of-range values) becomes an
 * `invalid_response` AiError so callers can fall back to deterministic
 * rule-based output instead of rendering garbage.
 */
export async function generateAiJson<T>(params: GenerateTextParams & {
  schema: ZodType<T>;
  maxOutputTokens?: number;
}): Promise<T> {
  const { response } = await generateResponse(params, "json");
  const raw = textOf(response);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    throw new AiError("invalid_response", "The AI provider returned malformed JSON.");
  }

  const result = params.schema.safeParse(parsed);
  if (!result.success) {
    throw new AiError("invalid_response", "The AI provider returned an unexpected shape.");
  }
  return result.data;
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}
