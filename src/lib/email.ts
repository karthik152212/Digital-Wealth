/**
 * Verification-email delivery for Better Auth.
 *
 * Delivery strategy (smallest maintainable option for this prototype):
 *
 *  - Provider mode: when BREVO_API_KEY (or, during the migration window, the
 *    legacy RESEND_API_KEY) and EMAIL_FROM are set, emails are sent through
 *    Brevo's transactional HTTP API using fetch — no extra dependency.
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

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const VERIFICATION_LINK_TTL_HOURS = 24;

/**
 * API key for the provider. `BREVO_API_KEY` is the primary name; the legacy
 * `RESEND_API_KEY` is still present in Vercel and is honoured as a fallback
 * so a rollback during the migration window needs no code change. Remove the
 * fallback only after the Brevo cutover has been verified.
 */
function providerApiKey(): string | undefined {
  return (
    process.env.BREVO_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim()
  );
}

/**
 * Parse EMAIL_FROM into Brevo's required `{ email, name }` sender object.
 * Accepts `Name <address@domain>` or a bare `address@domain`.
 *
 * Throws a configuration error without ever echoing the raw value, because
 * the caller may surface the message.
 */
function parseSender(from: string): { email: string; name?: string } {
  const bracketed = /^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>$/.exec(from);
  if (bracketed) {
    const name = bracketed[1].trim().replace(/^"|"$/g, "");
    return name ? { email: bracketed[2], name } : { email: bracketed[2] };
  }
  if (/^[^<>\s]+@[^<>\s]+$/.test(from)) {
    return { email: from };
  }
  throw new Error(
    "EMAIL_FROM is not a valid sender (expected \"Name <address@domain>\" or an address).",
  );
}

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
  const apiKey = providerApiKey();
  const from = process.env.EMAIL_FROM?.trim();

  if (apiKey && from) {
    const sender = parseSender(from);
    const link = buildVerificationLink(input.token);
    const { subject, text, html } = renderEmail(input.user, link);
    let response: Response;
    try {
      response = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          // Brevo authenticates with a dedicated header, not Authorization.
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [
            {
              email: input.user.email,
              name: input.user.name || undefined,
            },
          ],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
    } catch {
      // No token, no credentials in the error.
      throw new Error("Email provider request failed.");
    }
    // Brevo answers 201 with a messageId on success; any non-2xx is a
    // rejection (invalid/unverified sender, exhausted credits, bad key).
    if (!response.ok) {
      throw new Error(`Email provider rejected the message (${response.status}).`);
    }
    return { mode: "provider", delivered: true };
  }

  if (process.env.NODE_ENV === "production") {
    // Fail loudly instead of silently dropping verification mail.
    // (No token or secret is included in this message.)
    throw new Error(
      "Email delivery is not configured. Set BREVO_API_KEY and EMAIL_FROM.",
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
      "  Configure BREVO_API_KEY + EMAIL_FROM for real delivery.",
      "──────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
  return { mode: "dev-console", delivered: false };
}
