/**
 * Gemini provider regression tests.
 *
 * Root cause covered here: the app defaulted to `gemini-2.5-flash`, which the
 * Gemini API now answers with HTTP 404 NOT_FOUND ("This model ... is no longer
 * available to new users"). The 404 was classified as a generic provider
 * error, so the dashboard showed the rule-based fallback banner and chat
 * answered 502 even though GEMINI_API_KEY was valid.
 *
 * Unit half — no network:
 *  - Google's real 404 payload classifies as `model_unavailable` (non-retryable)
 *    instead of an opaque `provider_error`.
 *  - 400 / 401 / 429 / 504 keep their distinct codes, so callers can tell a
 *    bad key, a bad request, a quota problem and an outage apart.
 *  - The model candidates the app will actually send never include the
 *    retired 2.5-series default, are de-duplicated, and honour GEMINI_MODEL.
 *
 * Live half — runs only when GEMINI_API_KEY is set (skipped otherwise):
 *  - the same `generateAiText` / `generateAiJson` entry points the API routes
 *    use return real model output, which fails immediately if the configured
 *    model is retired again.
 *
 * The API key itself is never printed, logged or asserted on.
 */
import "dotenv/config";

import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { z } from "zod";

import {
  AiError,
  aiModel,
  classifyAiError,
  generateAiJson,
  generateAiText,
  isAiConfigured,
  modelCandidates,
} from "@/lib/ai";

/** Exactly what the Gemini API returned for gemini-2.5-flash with a new key. */
const RETIRED_MODEL_ERROR = {
  status: 404,
  message: JSON.stringify({
    error: {
      code: 404,
      message:
        "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.",
      status: "NOT_FOUND",
    },
  }),
};

describe("AI provider error classification", () => {
  test("a retired model (404 NOT_FOUND) is model_unavailable, not a generic failure", () => {
    const error = classifyAiError(RETIRED_MODEL_ERROR);
    assert.equal(error.code, "model_unavailable");
    assert.equal(error.retryable, false, "repeating a retired model cannot succeed");
  });

  test("a rejected request body (400) is invalid_request", () => {
    const error = classifyAiError({
      status: 400,
      message:
        '{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}',
    });
    assert.equal(error.code, "invalid_request");
  });

  test("a rejected thinkingConfig (400) is invalid_request so the plain retry can run", () => {
    const error = classifyAiError({
      status: 400,
      message:
        "Request contains an invalid argument. Invalid value at 'generation_config.thinking_config.thinking_budget'",
    });
    assert.equal(error.code, "invalid_request");
  });

  test("auth, quota and outage keep their own codes", () => {
    assert.equal(
      classifyAiError({ status: 401, message: "API key not valid." }).code,
      "provider_auth",
    );
    assert.equal(
      classifyAiError({ status: 429, message: "RESOURCE_EXHAUSTED: quota exceeded" }).code,
      "rate_limited",
    );
    const outage = classifyAiError({
      status: 504,
      message: '{"error":{"code":504,"message":"Deadline expired before operation could complete.","status":"DEADLINE_EXCEEDED"}}',
    });
    assert.equal(outage.code, "provider_error");
    assert.equal(outage.retryable, true, "a 5xx is worth a fallback attempt");
  });

  test("an AiError passes through untouched", () => {
    const original = new AiError("not_configured", "missing key");
    assert.equal(classifyAiError(original), original);
  });
});

describe("model selection", () => {
  test("candidates start with the configured model, de-duplicated, without the retired default", () => {
    const candidates = modelCandidates();
    assert.ok(candidates.length >= 1);
    assert.equal(candidates[0], aiModel());
    assert.equal(new Set(candidates).size, candidates.length, "duplicate candidates");
    assert.ok(
      !candidates.includes("gemini-2.5-flash"),
      "gemini-2.5-flash is retired for new keys and must not be requested",
    );
  });

  test("GEMINI_MODEL overrides the default", () => {
    const previous = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = "gemini-3.6-flash";
    try {
      assert.equal(aiModel(), "gemini-3.6-flash");
      assert.equal(modelCandidates()[0], "gemini-3.6-flash");
    } finally {
      if (previous === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = previous;
    }
  });
});

describe("live Gemini generation", () => {
  /**
   * Free-tier quota (20 requests/day per model) is a provider-side ceiling,
   * not a code regression, so exhausting every candidate model skips instead
   * of failing. Everything else — including the retired-model 404 this file
   * exists for — must still fail loudly.
   */
  function skipIfQuotaExhausted(t: TestContext, error: unknown): boolean {
    if (error instanceof AiError && error.code === "rate_limited") {
      t.skip("Gemini free-tier quota is exhausted right now; retry after the window resets");
      return true;
    }
    return false;
  }

  test("the configured model answers a real text request", async (t) => {
    if (!isAiConfigured()) {
      t.skip("GEMINI_API_KEY is not set — skipping the live provider check");
      return;
    }

    try {
      const result = await generateAiText({
        system: "You are a connectivity test harness. Reply exactly as asked.",
        prompt: "Reply with exactly: OK",
        maxOutputTokens: 64,
        temperature: 0,
      });

      assert.ok(result.text.length > 0, "the model returned no text");
      assert.match(result.text, /ok/i, `unexpected reply: ${result.text.slice(0, 80)}`);
      assert.ok(modelCandidates().includes(result.model), "replied by an unknown model");
    } catch (error) {
      if (skipIfQuotaExhausted(t, error)) return;
      throw error;
    }
  });

  test("the configured model answers a real JSON request", async (t) => {
    if (!isAiConfigured()) {
      t.skip("GEMINI_API_KEY is not set — skipping the live provider check");
      return;
    }

    try {
      const parsed = await generateAiJson({
        system: "Return JSON only, no prose and no code fences.",
        prompt: 'Return exactly this shape: {"ok":true,"note":"hello"}',
        schema: z.object({ ok: z.boolean(), note: z.string() }),
        maxOutputTokens: 256,
      });

      assert.equal(parsed.ok, true);
      assert.equal(parsed.note, "hello");
    } catch (error) {
      if (skipIfQuotaExhausted(t, error)) return;
      throw error;
    }
  });
});
