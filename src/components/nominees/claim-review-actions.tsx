"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClaimReviewActionsProps = {
  requestId: string;
  assetTitle: string;
  nomineeName: string;
};

type ApiErrorResponse = {
  error?: string;
};

export function ClaimReviewActions({
  requestId,
  assetTitle,
  nomineeName,
}: ClaimReviewActionsProps) {
  const router = useRouter();

  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    setBusy("approve");
    setError(null);
    try {
      const response = await fetch(`/api/inheritance/${requestId}/approve`, {
        method: "POST",
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;
      if (!response.ok) {
        setError(data?.error ?? "Could not approve the claim.");
        return;
      }
      toast.success(
        `Claim approved. Guidance-only access to ${assetTitle} was released to ${nomineeName}. Nothing was transferred.`,
      );
      router.refresh();
    } catch {
      setError("Could not approve the claim.");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      const response = await fetch(`/api/inheritance/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reason.trim() !== "" ? { reason: reason.trim() } : {},
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
        setError(data?.error ?? "Could not reject the claim.");
        return;
      }
      setRejectOpen(false);
      toast.success("Claim rejected. No access was granted.");
      router.refresh();
    } catch {
      setError("Could not reject the claim.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={approve}
        >
          {busy === "approve" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Approve claim
        </Button>
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy !== null}>
              <X className="size-4" />
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject this claim?</DialogTitle>
              <DialogDescription>
                You are still in control of this asset. Rejecting records a
                declined decision for audit; nothing is released.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`reject-reason-${requestId}`}>
                Reason (optional)
              </Label>
              <Textarea
                id={`reject-reason-${requestId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Why are you rejecting this claim?"
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
                onClick={reject}
              >
                {busy === "reject" && <Loader2 className="size-4 animate-spin" />}
                {busy === "reject" ? "Rejecting…" : "Reject claim"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-xs text-muted-foreground">
        Approval releases guidance-only recovery information. No password,
        secret, fund or ownership transfer happens.
      </p>
    </div>
  );
}
