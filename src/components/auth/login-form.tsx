"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Google sign-in failed to start. Please try again.");
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Your digital wealth, protected.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {googleEnabled ? (
          <GoogleSignInButton onError={setError} />
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              Google sign-in is not configured. Please contact support.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Sign in securely with your Google account.
        </p>
      </CardContent>
    </Card>
  );
}
