"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClaimRequestActionsProps = {
  requestId: string;
  status: string;
  expired: boolean;
  canSubmit: boolean;
  canDecline: boolean;
  claimCodeRequired: boolean;
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
  fields?: Record<string, string>;
  status?: string;
};

const NOTICE_TEXT =
  "I understand that this is a simulated claim. Inactivity is not confirmation of death, this prototype establishes no legal entitlement, and no asset access or fund movement occurs.";

export function ClaimRequestActions({
  requestId,
  status,
  expired,
  canSubmit,
  canDecline,
  claimCodeRequired,
}: ClaimRequestActionsProps) {
  const router = useRouter();

  const [attested, setAttested] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [busy, setBusy] = useState<"claim" | "submit" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const step = canSubmit || status === "ELIGIBLE" ? "submit" : "claim";
  const showClaimCodeInput = step === "claim" && claimCodeRequired;

  async function initiateClaim() {
    setBusy("claim");
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch(`/api/me/inheritance/${requestId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attestation: true,
          ...(claimCode.trim() !== "" ? { claimCode: claimCode.trim() } : {}),
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;
      if (!response.ok) {
        if (data?.fields) setFieldErrors(data.fields);
        setError(data?.error ?? "Could not initiate the claim.");
        return;
      }
      toast.success(
        "Claim initiated. Eligibility recorded — nothing has been released. Submit the claim next.",
      );
      router.refresh();
    } catch {
      setError("Could not initiate the claim.");
    } finally {
      setBusy(null);
    }
  }

  async function submitClaim() {
    setBusy("submit");
    setError(null);
    try {
      const response = await fetch(
        `/api/me/inheritance/${requestId}/submit-claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attestation: true }),
        },
      );
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;
      if (!response.ok) {
        setError(data?.error ?? "Could not submit the claim.");
        return;
      }
      toast.success(
        "Claim submitted. It now awaits the owner's confirmation — no access has been granted.",
      );
      router.refresh();
    } catch {
      setError("Could not submit the claim.");
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    setBusy("decline");
    setError(null);
    try {
      const response = await fetch(`/api/me/inheritance/${requestId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          declineReason.trim() !== "" ? { reason: declineReason.trim() } : {},
        ),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;
      if (!response.ok) {
        setError(data?.error ?? "Could not decline the request.");
        return;
      }
      setDeclineOpen(false);
      toast.success("Request declined. No access was granted.");
      router.refresh();
    } catch {
      setError("Could not decline the request.");
    } finally {
      setBusy(null);
    }
  }

  if (expired || status === "EXPIRED") {
    return (
      <p className="text-xs text-muted-foreground">
        Claim window elapsed — this request is expired. Expiry is not
        confirmation of death and granted no access.
      </p>
    );
  }

  if (status === "RELEASED") {
    return null;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(step === "claim" || step === "submit") && (
        <div className="space-y-2 rounded-lg border p-3">
          {step === "submit" ? (
            <p className="text-xs text-muted-foreground">
              Eligibility is recorded. Submitting re-confirms your identity and
              sends the claim to the owner for confirmation. Nothing is
              released automatically.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{NOTICE_TEXT}</p>
              {showClaimCodeInput && (
                <div className="space-y-1">
                  <Label htmlFor={`claim-code-${requestId}`} className="text-xs">
                    Claim code from the owner
                  </Label>
                  <Input
                    id={`claim-code-${requestId}`}
                    value={claimCode}
                    onChange={(event) => setClaimCode(event.target.value)}
                    maxLength={128}
                    autoComplete="off"
                    aria-invalid={fieldErrors.claimCode ? true : undefined}
                    placeholder="Enter the one-time code"
                  />
                  {fieldErrors.claimCode && (
                    <p className="text-sm text-destructive">
                      {fieldErrors.claimCode}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={busy !== null || (step === "claim" && !attested)}
              onClick={step === "claim" ? initiateClaim : submitClaim}
            >
              {busy === (step === "claim" ? "claim" : "submit") && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {step === "claim" ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Initiate claim
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Submit claim
                </>
              )}
            </Button>
            {step === "claim" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={attested}
                  onCheckedChange={(value) => setAttested(value === true)}
                />
                I acknowledge the notice above
              </label>
            )}
          </div>
        </div>
      )}

      {canDecline && (
        <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
            >
              <XCircle className="size-4" />
              Decline request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline this request?</DialogTitle>
              <DialogDescription>
                Declining closes this request permanently. No access is
                granted, and the decision is recorded for audit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`decline-reason-${requestId}`}>
                Reason (optional)
              </Label>
              <Textarea
                id={`decline-reason-${requestId}`}
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Why are you declining?"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" disabled={busy !== null}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={busy !== null}
                onClick={decline}
              >
                {busy === "decline" && <Loader2 className="size-4 animate-spin" />}
                {busy === "decline" ? "Declining…" : "Decline"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
