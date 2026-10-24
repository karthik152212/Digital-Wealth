import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Inbox, Loader2 } from "lucide-react";

import { listMyInheritance } from "@/lib/inheritance";
import { categoryLabel } from "@/lib/asset-schemas";
import { getSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClaimRequestActions } from "@/components/nominee/claim-request-actions";

export const instant = false;

export const metadata: Metadata = {
  title: "Nominee portal | Digital Wealth Vault",
};

const STATUS_LABELS: Record<string, string> = {
  INVITED: "Invited",
  ELIGIBLE: "Eligible",
  CLAIMED_PENDING_CONFIRM: "Claim pending",
  RELEASED: "Released",
  REVOKED: "Revoked",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "RELEASED" || status === "ELIGIBLE") return "default";
  if (
    status === "REVOKED" ||
    status === "EXPIRED" ||
    status === "DECLINED"
  ) {
    return "secondary";
  }
  return "outline";
}

async function NomineePortalContent() {
  await connection();
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const requests = await listMyInheritance(session.user.email);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to vault
          </Link>
        </Button>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Nominee portal
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          These are the requests where you are the named nominee. Claiming
          records your acknowledgement — inactivity is never confirmation of
          death, this prototype establishes no legal entitlement, and no
          asset access, password or fund movement occurs. Only an owner
          approval can release anything.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No inheritance requests</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              You have not been named a nominee for any asset yet. Owners
              invite you from their nominees page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {request.assetTitle}
                      {request.nomineeStatus === "REVOKED" && (
                        <Badge
                          variant="secondary"
                          className="ml-2 align-middle"
                        >
                          You are revoked
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {categoryLabel(request.assetCategory)} · from{" "}
                      {request.ownerName} · invited {formatDate(request.invitedAt)}
                      {request.attempt > 1 && ` · attempt ${request.attempt}`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={statusVariant(request.status)}>
                      {STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                    {request.status === "INVITED" && !request.expired && (
                      <span className="text-xs text-muted-foreground">
                        Window ends {formatDate(request.graceEndsAt)}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.status === "RELEASED" ? (
                  request.authorizationActive ? (
                    <Button asChild size="sm">
                      <Link href={`/dashboard/nominee/${request.assetId}`}>
                        Open recovery view
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This request was released, but the owner revoked the
                      authorization. No access is available.
                    </p>
                  )
                ) : null}

                {request.declineReason && (
                  <p className="text-xs text-muted-foreground">
                    Decline reason: {request.declineReason}
                  </p>
                )}

                <ClaimRequestActions
                  requestId={request.id}
                  status={request.status}
                  expired={request.expired}
                  canSubmit={request.canSubmit}
                  canDecline={request.canDecline}
                  claimCodeRequired={request.claimCodeRequired}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Every action on these requests is recorded as an immutable audit
        event. Nothing happens automatically.
      </p>
    </div>
  );
}

export default function NomineePortalPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading nominee portal…
          </div>
        </div>
      }
    >
      <NomineePortalContent />
    </Suspense>
  );
}
