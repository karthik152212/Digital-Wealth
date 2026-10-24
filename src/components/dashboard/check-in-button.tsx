"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function CheckInButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckIn() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/check-in", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Check-in failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Check-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleCheckIn} disabled={loading} size="sm">
        {loading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 size-4" />
        )}
        I&apos;m active — update my check-in
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
