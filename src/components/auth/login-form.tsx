"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MailWarning } from "lucide-react";

import { authClient } from "@/lib/auth-client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type AuthResponse = {
  error?: { message?: string; code?: string; status?: number } | null;
  data?: unknown;
};

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifyRequired, setVerifyRequired] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResendNotice(null);
    setLoading(true);
    try {
      const res = (await authClient.signIn.email({
        email: email.trim(),
        password,
      })) as AuthResponse;
      if (res?.error) {
        // Server-side rejection: the account exists but its email is not
        // verified (Better Auth returns 403 EMAIL_NOT_VERIFIED).
        if (res.error.code === "EMAIL_NOT_VERIFIED") {
          setVerifyRequired(true);
          return;
        }
        // 5xx responses mean the server failed (database, config, outage);
        // show an honest, user-safe message instead of blaming credentials.
        if ((res.error.status ?? 0) >= 500) {
          setError(
            "The server hit an unexpected error. Please try again in a moment.",
          );
          return;
        }
        setError(res.error.message ?? "Invalid email or password.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      // The fetch itself threw (server unreachable/off, network drop, or an
      // unparseable response) — say so instead of the generic message.
      setError(
        "Could not reach the authentication server. Check that it is running, then try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Google sign-in failed to start.");
      setGoogleLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Access your digital wealth vault with your email and password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {verifyRequired && !error && (
            <Alert>
              <MailWarning className="size-4" />
              <AlertTitle>Email verification required</AlertTitle>
              <AlertDescription className="space-y-3">
                <span>
                  Confirm your email address before signing in. Check your
                  inbox for the verification link.
                </span>
                {resendNotice && <span>{resendNotice}</span>}
                <ResendVerificationButton
                  email={email.trim().toLowerCase()}
                  className="w-full"
                  onResult={(result) => {
                    if (result.ok) {
                      setResendNotice(
                        "Verification email sent. Check your inbox (or the server console in local development).",
                      );
                    } else if (result.reason === "rate-limited") {
                      setResendNotice(
                        `Too many resend attempts. Please wait ${result.retryAfter} seconds.`,
                      );
                    } else {
                      setResendNotice(
                        "We couldn't send the verification email. Please try again later.",
                      );
                    }
                  }}
                />
                <Link
                  href={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                  className="block text-sm text-primary hover:underline"
                >
                  Go to the verification page
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
            or
          </span>
        </div>

        {googleEnabled ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Continue with Google
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Google sign-in is not configured. Use email and password.
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
