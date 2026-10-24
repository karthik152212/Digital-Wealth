/**
 * Verification-email delivery for Better Auth.
 *
 * Delivery strategy (smallest maintainable option for this prototype):
 *
 *  - Provider mode: when RESEND_API_KEY and EMAIL_FROM are set, emails are
 *    sent through the Resend HTTP API using fetch — no extra dependency.
 *  - Dev-console mode: when no provider is configured (the current state of
 *    this environment), the verification link is printed to the `next dev`
 *    server console so the flow can be completed locally. This fallback is
 *    disabled in production, where a missing provider is reported as a
 *    configuration error instead.
 *
 * Links are always built from the configured application base URL
 * (NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL env vars) — never from the
 * untrusted Host header of an incoming request.
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const VERIFICATION_LINK_TTL_HOURS = 24;

export type VerificationEmailInput = {
  user: { name: string; email: string };
  /** Raw verification token from Better Auth. */
  token: string;
};

export type VerificationEmailResult = {
  /** Where the message went. "dev-console" means no real inbox delivery. */
  mode: "provider" | "dev-console";
  /** True only when an external provider accepted the message. */
  delivered: boolean;
};

/** Configured application base URL (no trailing slash). */
export function appBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.BETTER_AUTH_URL?.trim();
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Build the verification link the user clicks. It points at our own
 * /verify-email page (which calls Better Auth's /api/auth/verify-email)
 * and is always derived from the configured base URL.
 */
export function buildVerificationLink(token: string): string {
  return `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

function renderEmail(user: { name: string; email: string }, link: string) {
  const subject = "Verify your email — Digital Wealth Vault";
  const text = [
    `Hi ${user.name || "there"},`,
    "",
    "Welcome to Digital Wealth Vault. Confirm your email address to activate your vault:",
    link,
    "",
    `This link expires in ${VERIFICATION_LINK_TTL_HOURS} hours and can only be used once.`,
    "If you did not create this account, you can safely ignore this email.",
  ].join("\n");
  const html = [
    `<p>Hi ${user.name || "there"},</p>`,
    "<p>Welcome to <strong>Digital Wealth Vault</strong>. Confirm your email address to activate your vault:</p>",
    `<p><a href="${link}">Verify my email</a></p>`,
    `<p style="color:#666;font-size:13px">This link expires in ${VERIFICATION_LINK_TTL_HOURS} hours and can only be used once. If you did not create this account, you can safely ignore this email.</p>`,
  ].join("\n");
  return { subject, text, html };
}

/**
 * Deliver a verification email. Called by Better Auth's
 * `emailVerification.sendVerificationEmail` hook.
 *
 * Throws (without ever including the token) when a provider is configured
 * but delivery fails, or when running in production with no provider —
 * so a delivery/configuration failure is never reported to the user as
 * success.
 */
export async function deliverVerificationEmail(
  input: VerificationEmailInput,
): Promise<VerificationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (apiKey && from) {
    const link = buildVerificationLink(input.token);
    const { subject, text, html } = renderEmail(input.user, link);
    let response: Response;
    try {
      response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.user.email],
          subject,
          text,
          html,
        }),
      });
    } catch {
      // No token, no credentials in the error.
      throw new Error("Email provider request failed.");
    }
    if (!response.ok) {
      throw new Error(`Email provider rejected the message (${response.status}).`);
    }
    return { mode: "provider", delivered: true };
  }

  if (process.env.NODE_ENV === "production") {
    // Fail loudly instead of silently dropping verification mail.
    // (No token or secret is included in this message.)
    throw new Error(
      "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    );
  }

  // Local-development fallback: print the link to the server console only.
  // Never reached in production.
  const link = buildVerificationLink(input.token);
  console.log(
    [
      "",
      "──────────────────────────────────────────────────────────",
      "[dev-email] Verification email (no provider configured).",
      `  To:      ${input.user.email}`,
      `  Link:    ${link}`,
      `  Expires: ${VERIFICATION_LINK_TTL_HOURS}h`,
      "  Configure RESEND_API_KEY + EMAIL_FROM for real delivery.",
      "──────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
  return { mode: "dev-console", delivered: false };
}
