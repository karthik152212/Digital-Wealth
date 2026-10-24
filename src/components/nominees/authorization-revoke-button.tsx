"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
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

type AuthorizationRevokeButtonProps = {
  authorizationId: string;
  assetTitle: string;
  nomineeName: string;
};

type ApiErrorResponse = {
  error?: string;
  alreadyRevoked?: boolean;
};

export function AuthorizationRevokeButton({
  authorizationId,
  assetTitle,
  nomineeName,
}: AuthorizationRevokeButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/authorizations/${authorizationId}/revoke`,
        { method: "POST" },
      );
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;
      if (!response.ok) {
        setError(data?.error ?? "Could not revoke the authorization.");
        return;
      }
      setOpen(false);
      toast.success(
        `Access to ${assetTitle} revoked for ${nomineeName}. The released request stays released for audit.`,
      );
      router.refresh();
    } catch {
      setError("Could not revoke the authorization.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Ban className="size-3.5" />
        )}
        Revoke access
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke guidance-only access?</DialogTitle>
            <DialogDescription>
              This revokes the active authorization for {nomineeName} on{" "}
              {assetTitle}. The released request is kept for audit and is not
              reactivated by anything.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={revoke}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Revoking…" : "Revoke access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
