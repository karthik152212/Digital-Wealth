"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, MailCheck, ShieldCheck } from "lucide-react";

import { ResendVerificationButton } from "@/components/auth/resend-verification-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Phase = "checking" | "pending" | "verified" | "expired" | "invalid";
type Notice = { tone: "success" | "error"; text: string };

/**
 * Verification flow states:
 *  - checking: a token is being verified against Better Auth
 *  - pending:  "check your email" + resend action (also the post-sign-up screen)
 *  - verified: success, with a clear route back to login
 *  - expired:  the link's 24h window passed — resend offered
 *  - invalid:  tampered/unknown/already-used link — resend offered
 * Delivery/config failures surface as notices from the resend action.
 */
export function VerifyEmailPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email")?.trim().toLowerCase() ?? null;

  const [phase, setPhase] = useState<Phase>(
    token ? "checking" : emailParam ? "pending" : "invalid",
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (response.ok) {
          setPhase("verified");
          return;
        }
        let code = "";
        try {
          const body = (await response.json()) as { code?: string };
          code = typeof body?.code === "string" ? body.code : "";
        } catch {
          // Non-JSON error body — treat as an invalid link.
        }
        setPhase(code === "TOKEN_EXPIRED" ? "expired" : "invalid");
      } catch {
        if (!cancelled) setPhase("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleResend(result: Parameters<
    NonNullable<React.ComponentProps<typeof ResendVerificationButton>["onResult"]>
  >[0]) {
    if (result.ok) {
      setNotice({
        tone: "success",
        text: "Verification email sent. Check your inbox (or the server console in local development).",
      });
    } else if (result.reason === "rate-limited") {
      setNotice({
        tone: "error",
        text: `Too many resend attempts. Please wait ${result.retryAfter} seconds before trying again.`,
      });
    } else {
      setNotice({
        tone: "error",
        text: "We couldn't send the verification email. Please try again later.",
      });
    }
  }

  const canResend = Boolean(emailParam);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {phase === "checking" && "Checking your link…"}
          {phase === "pending" && "Check your email"}
          {phase === "verified" && "Email verified"}
          {phase === "expired" && "Verification link expired"}
          {phase === "invalid" && "Invalid verification link"}
        </CardTitle>
        <CardDescription>
          {phase === "pending" &&
            "We sent a verification link to your email address."}
          {phase === "verified" &&
            "Your email address has been confirmed."}
          {phase === "expired" &&
            "This link is no longer valid. Request a new one below."}
          {phase === "invalid" &&
            "This link is invalid, has already been used, or was tampered with."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === "checking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Verifying your email address…
          </div>
        )}

        {phase === "pending" && emailParam && (
          <Alert>
            <MailCheck className="size-4" />
            <AlertTitle>Email sent</AlertTitle>
            <AlertDescription>
              A verification link was sent to <strong>{emailParam}</strong>.
              The link expires in 24 hours.
            </AlertDescription>
          </Alert>
        )}

        {phase === "verified" && (
          <Alert>
            <ShieldCheck className="size-4" />
            <AlertTitle>Verification successful</AlertTitle>
            <AlertDescription>
              Your account is now fully active.
            </AlertDescription>
          </Alert>
        )}

        {(phase === "expired" || phase === "invalid") && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {phase === "expired" ? "Link expired" : "Link rejected"}
            </AlertTitle>
            <AlertDescription>
              {phase === "expired"
                ? "Verification links are valid for 24 hours. Send a fresh link to continue."
                : "For your security, expired or altered links are rejected. Send a new link to try again."}
            </AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant={notice.tone === "error" ? "destructive" : "default"}>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        )}

        {phase === "verified" ? (
          <Button asChild className="w-full">
            <Link href="/login">Continue to sign in</Link>
          </Button>
        ) : (
          canResend && (
            <ResendVerificationButton
              email={emailParam!}
              onResult={handleResend}
              className="w-full"
            />
          )
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
