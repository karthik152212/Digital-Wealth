"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ResendResult =
  | { ok: true }
  | { ok: false; reason: "rate-limited"; retryAfter: number }
  | { ok: false; reason: "failed" };

type Props = {
  email: string;
  onResult?: (result: ResendResult) => void;
  disabled?: boolean;
  className?: string;
};

const COOLDOWN_SECONDS = 60;

/**
 * "Resend verification email" action with loading and cooldown states.
 * Throttling is enforced server-side (Better Auth's rate limiter on
 * /send-verification-email, 3/min/IP); this cooldown only shapes the UX.
 */
export function ResendVerificationButton({
  email,
  onResult,
  disabled,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (loading || cooldown > 0 || !email) return;
    setLoading(true);
    try {
      // Plugin endpoint with the server-enforced per-email cooldown.
      // The cooldown/429 below is authoritative on the server; this button's
      // disabled state is only UX on top of it.
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackURL: "/login" }),
      });
      if (response.status === 429) {
        const retryAfter =
          Number.parseInt(
            response.headers.get("X-Retry-After") ?? "",
            10,
          ) || COOLDOWN_SECONDS;
        setCooldown(retryAfter);
        onResult?.({ ok: false, reason: "rate-limited", retryAfter });
      } else if (!response.ok) {
        onResult?.({ ok: false, reason: "failed" });
      } else {
        setCooldown(COOLDOWN_SECONDS);
        onResult?.({ ok: true });
      }
    } catch {
      onResult?.({ ok: false, reason: "failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleResend}
      disabled={disabled || loading || cooldown > 0}
    >
      {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
      {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}
    </Button>
  );
}
