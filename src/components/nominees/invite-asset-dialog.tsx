"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Send } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AssetOption = {
  id: string;
  title: string;
  category: string;
  status: string;
};

type InviteAssetDialogProps = {
  nomineeId: string;
  nomineeName: string;
  disabled?: boolean;
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
};

export function InviteAssetDialog({
  nomineeId,
  nomineeName,
  disabled,
}: InviteAssetDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<AssetOption[] | null>(null);
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentCode, setSentCode] = useState<{ assetTitle: string; code: string } | null>(null);

  const loadingAssets = open && assets === null && !sentCode;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setAssets(null);
      setSentCode(null);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open || sentCode) return;
    let cancelled = false;
    fetch("/api/assets")
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          if (!cancelled) {
            setAssets([]);
            setError("Could not load your assets. Please try again.");
          }
          return;
        }
        const data = (await response.json().catch(() => null)) as {
          assets?: AssetOption[];
        } | null;
        if (!cancelled) setAssets(data?.assets ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setAssets([]);
          setError("Could not load your assets.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, router, sentCode]);

  async function handleInvite() {
    if (!assetId) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${assetId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomineeId }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | (ApiErrorResponse & { id?: string; claimCode?: string })
        | null;
      if (!response.ok) {
        setError(
          data?.error ?? "Could not send the invitation. Please try again.",
        );
        return;
      }
      const assetTitle =
        assets?.find((asset) => asset.id === assetId)?.title ?? "the asset";
      setSentCode({ assetTitle, code: data?.claimCode ?? "" });
      toast.success(`Invitation sent to ${nomineeName}.`);
      router.refresh();
    } catch {
      setError("Could not send the invitation. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function copyCode() {
    if (!sentCode) return;
    try {
      await navigator.clipboard.writeText(sentCode.code);
      toast.success("Claim code copied.");
    } catch {
      toast.error("Could not copy the claim code.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Send className="size-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        {sentCode ? (
          <>
            <DialogHeader>
              <DialogTitle>Claim code for {nomineeName}</DialogTitle>
              <DialogDescription>
                Share this one-time claim code with {nomineeName} over a
                channel you trust. It is shown once and cannot be viewed
                again — only a hash is stored. It is a safety step for the
                prototype, not confirmation of death and not a legal
                instrument. Ask them to issue a new invitation if the code is
                lost.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Claim code for {sentCode.assetTitle}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-sm tracking-widest">
                  {sentCode.code}
                </code>
                <Button variant="outline" size="sm" onClick={copyCode}>
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  onClick={() => {
                    setSentCode(null);
                    setAssetId("");
                  }}
                >
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite {nomineeName}</DialogTitle>
              <DialogDescription>
                Send an in-app inheritance invitation for one of your assets.
                This records an invitation and a claim window deadline only —
                no asset access is granted, and nothing is released
                automatically. A one-time claim code will be shown once for
                you to share.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {assets === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading your assets…
              </div>
            ) : assets.length === 0 && !error ? (
              <p className="text-sm text-muted-foreground">
                You have no assets to invite this nominee to yet. Add an asset
                first.
              </p>
            ) : assets.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="invite-asset">Asset</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger id="invite-asset">
                    <SelectValue placeholder="Select an asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.title}
                        {asset.status === "ARCHIVED" ? " (archived)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={sending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                disabled={sending || !assetId || loadingAssets}
                onClick={handleInvite}
              >
                {sending && <Loader2 className="size-4 animate-spin" />}
                {sending ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
