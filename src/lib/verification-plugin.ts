/**
 * Better Auth plugin: POST /api/auth/resend-verification
 *
 * Re-send of the verification email with server-enforced limits:
 *
 *  - Per-email cooldown (shared PostgreSQL `RateLimit` store, atomic CAS —
 *    concurrent requests from any number of instances produce exactly one
 *    outbound send). Enforced BEFORE any account lookup so the 429 behavior
 *    is identical for existing, unknown, and already-verified emails.
 *  - Per-IP rate limit via the plugin's `rateLimit` rule, backed by Better
 *    Auth's database rate-limit storage (shared across instances).
 *  - Anti-enumeration: the success body is always `{ status: true }` with
 *    the same 500ms timing floor Better Auth uses on its built-in endpoint;
 *    no account state appears in any response.
 *
 * The token itself is created with Better Auth's own exported
 * `createEmailVerificationToken` (stateless HS256 JWT) and delivery goes
 * through the configured `emailVerification.sendVerificationEmail` delivery
 * module — i.e. the library's supported verification flow, not a custom one.
 */

import { createAuthEndpoint, APIError } from "better-auth/api";
import { createEmailVerificationToken } from "better-auth/api";
import * as z from "zod";

import { deliverVerificationEmail } from "@/lib/email";
import {
  claimResendCooldown,
  resendIpMax,
  resendIpWindowSeconds,
} from "@/lib/verification-limits";

/** Same anti-enumeration floor Better Auth applies on its built-in endpoint. */
const TIMING_FLOOR_MS = 500;

export function verificationResendPlugin() {
  return {
    id: "verification-resend",
    endpoints: {
      resendVerification: createAuthEndpoint(
        "/resend-verification",
        {
          method: "POST",
          body: z.object({
            email: z.email(),
            callbackURL: z.string().optional(),
          }),
        },
        async (ctx) => {
          const email = ctx.body.email.trim().toLowerCase();

          // 1. Server-enforced cooldown — always claimed, before any account
          //    lookup, so responses never reveal whether the email exists.
          const claim = await claimResendCooldown(email);
          if (!claim.claimed) {
            throw new APIError(
              "TOO_MANY_REQUESTS",
              {
                message: "Too many requests. Please try again later.",
                code: "TOO_MANY_REQUESTS",
                retryAfter: claim.retryAfterSeconds,
              },
              {
                "Retry-After": String(claim.retryAfterSeconds),
                "X-Retry-After": String(claim.retryAfterSeconds),
              },
            );
          }

          // 2. Account lookup — identical response whether or not the email
          //    is known or already verified.
          const user = await ctx.context.internalAdapter.findUserByEmail(email);
          if (!user || user.user.emailVerified) {
            await new Promise((resolve) =>
              setTimeout(resolve, TIMING_FLOOR_MS),
            );
            return ctx.json({ status: true });
          }

          // 3. Library-issued token + configured delivery module.
          const token = await createEmailVerificationToken(
            ctx.context.secret,
            user.user.email,
            undefined,
            ctx.context.options.emailVerification?.expiresIn,
          );
          await deliverVerificationEmail({
            user: { name: user.user.name, email: user.user.email },
            token,
          });
          return ctx.json({ status: true });
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) => path === "/resend-verification",
        window: resendIpWindowSeconds(),
        max: resendIpMax(),
      },
    ],
  };
}
