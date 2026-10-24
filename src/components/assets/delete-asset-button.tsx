"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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

type AssetCounts = {
  inheritanceRequests: number;
  authorizations: number;
  valuations: number;
  sellingSteps: number;
};

type DeleteAssetButtonProps = {
  assetId: string;
  assetTitle: string;
  status: "ACTIVE" | "ARCHIVED";
  counts: AssetCounts;
};

function recordSummary(counts: AssetCounts): string {
  const parts: string[] = [];
  if (counts.inheritanceRequests > 0) {
    parts.push(
      `${counts.inheritanceRequests} inheritance request${counts.inheritanceRequests === 1 ? "" : "s"}`,
    );
  }
  if (counts.authorizations > 0) {
    parts.push(
      `${counts.authorizations} nominee authorization${counts.authorizations === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" and ");
}

export function DeleteAssetButton({
  assetId,
  assetTitle,
  status,
  counts,
}: DeleteAssetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protectedNow, setProtectedNow] = useState(
    counts.inheritanceRequests > 0 || counts.authorizations > 0,
  );

  const summary = recordSummary(counts);
  const isArchived = status === "ARCHIVED";

  async function changeStatus(next: "ACTIVE" | "ARCHIVED") {
    setMoving(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not update the asset.");
        return;
      }
      toast.success(
        next === "ARCHIVED"
          ? "Asset archived. Inheritance records were kept."
          : "Asset restored to active.",
      );
      router.refresh();
    } catch {
      setError("Could not update the asset.");
    } finally {
      setMoving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (response.status === 409) {
        setProtectedNow(true);
        setError(
          "This asset now has inheritance records linked to it, so it cannot be deleted. It has been kept — archive it instead.",
        );
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not delete the asset.");
        return;
      }
      setOpen(false);
      toast.success("Asset deleted.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not delete the asset.");
    } finally {
      setDeleting(false);
    }
  }

  if (protectedNow) {
    return (
      <div className="space-y-3">
        <Alert>
          <AlertDescription>
            Deletion is disabled: {summary} reference
            {counts.inheritanceRequests + counts.authorizations === 1
              ? "s"
              : ""}{" "}
            this asset. Archiving keeps those records intact.
          </AlertDescription>
        </Alert>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          variant="outline"
          disabled={moving}
          onClick={() => changeStatus(isArchived ? "ACTIVE" : "ARCHIVED")}
        >
          {moving && <Loader2 className="size-4 animate-spin" />}
          {isArchived ? "Restore to active" : "Archive asset"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
        Delete asset
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this asset?</DialogTitle>
            <DialogDescription>
              &ldquo;{assetTitle}&rdquo; and its valuation history
              {counts.valuations > 0
                ? ` (${counts.valuations} valuation${counts.valuations === 1 ? "" : "s"})`
                : ""}
              , recovery steps and official links will be permanently removed.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
