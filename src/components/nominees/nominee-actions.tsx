"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, UserX } from "lucide-react";
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
} from "@/components/ui/dialog";
import { InviteAssetDialog } from "@/components/nominees/invite-asset-dialog";
import { NomineeForm } from "@/components/nominees/nominee-form";

type NomineeActionsProps = {
  nomineeId: string;
  name: string;
  email: string;
  relationship: string;
  status: string;
};

type ApiErrorResponse = {
  error?: string;
  alreadyRevoked?: boolean;
  revokedRequests?: number;
};

export function NomineeActions({
  nomineeId,
  name,
  email,
  relationship,
  status,
}: NomineeActionsProps) {
  const router = useRouter();
  const isRevoked = status === "REVOKED";

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<"revoke" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setBusy("revoke");
    setError(null);
    try {
      const response = await fetch(`/api/nominees/${nomineeId}/revoke`, {
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
        setError(data?.error ?? "Could not revoke the nominee.");
        return;
      }
      setConfirmOpen(false);
      const requests = data?.revokedRequests ?? 0;
      toast.success(
        `Nominee revoked. Open inheritance requests were revoked (${requests}). Nothing was deleted.`,
      );
      router.refresh();
    } catch {
      setError("Could not revoke the nominee.");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setError(null);
    try {
      const response = await fetch(`/api/nominees/${nomineeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;
      if (!response.ok) {
        setError(data?.error ?? "Could not restore the nominee.");
        return;
      }
      toast.success(
        "Nominee restored. Previously revoked authorizations and requests stay revoked.",
      );
      router.refresh();
    } catch {
      setError("Could not restore the nominee.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isRevoked ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={restore}
        >
          {busy === "restore" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          Restore
        </Button>
      ) : (
        <>
          <InviteAssetDialog nomineeId={nomineeId} nomineeName={name} />
          <NomineeForm
            mode="edit"
            nomineeId={nomineeId}
            initial={{ name, email, relationship: relationship ?? "" }}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => setConfirmOpen(true)}
          >
            <UserX className="size-4" />
            Revoke
          </Button>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke {name}?</DialogTitle>
            <DialogDescription>
              They will no longer receive invitations. Open inheritance requests
              are revoked, any active authorizations are revoked, and every
              record is kept for audit. You can restore them later — restore
              never reactivates prior access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={busy !== null}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={revoke}
            >
              {busy === "revoke" && <Loader2 className="size-4 animate-spin" />}
              {busy === "revoke" ? "Revoking…" : "Revoke nominee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
