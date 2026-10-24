import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Loader2, Users } from "lucide-react";

import { listNominees } from "@/lib/nominees";
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
import { NomineeActions } from "@/components/nominees/nominee-actions";
import { NomineeForm } from "@/components/nominees/nominee-form";
import { ClaimReviewActions } from "@/components/nominees/claim-review-actions";
import { AuthorizationRevokeButton } from "@/components/nominees/authorization-revoke-button";

export const instant = false;

export const metadata: Metadata = {
  title: "Nominees | Digital Wealth Vault",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  INVITED: "Invited",
  ELIGIBLE: "Eligible",
  CLAIMED_PENDING_CONFIRM: "Claim pending",
  RELEASED: "Released",
  REVOKED: "Revoked",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function NomineesContent() {
  await connection();
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const nominees = await listNominees(session.user.id);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to vault
            </Link>
          </Button>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Nominees
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nominees are people you trust to recover your digital assets. Adding
            a nominee grants no access by itself — you invite them to specific
            assets when you are ready, and every change is recorded for audit.
          </p>
        </div>
        <NomineeForm mode="create" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your nominees</CardTitle>
          <CardDescription>
            Only nominees you own are shown, with their inheritance invitations
            and authorization counts. Revoking never deletes records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nominees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">No nominees yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add someone you trust. You can invite them to assets later —
                nothing is shared automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Relationship</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Inheritance requests</th>
                    <th className="pb-3 pr-4 font-medium">Authorizations</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {nominees.map((nominee) => (
                    <tr key={nominee.id} className="border-b align-top last:border-0">
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-medium ${
                              nominee.status === "REVOKED"
                                ? "text-muted-foreground line-through"
                                : ""
                            }`}
                          >
                            {nominee.name}
                          </span>
                          {nominee.isDemo && (
                            <Badge variant="outline" className="shrink-0">
                              Demo
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {nominee.email}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        {nominee.relationship || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <Badge
                          variant={
                            nominee.status === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {nominee.status === "ACTIVE" ? "Active" : "Revoked"}
                        </Badge>
                        {nominee.status === "REVOKED" && nominee.revokedAt && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Revoked {formatDate(nominee.revokedAt)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        {nominee.requests.length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <ul className="space-y-2.5">
                            {nominee.requests.map((request) => (
                              <li key={request.id}>
                                <Link
                                  href={`/dashboard/assets/${request.assetId}`}
                                  className="font-medium underline-offset-4 hover:underline"
                                >
                                  {request.assetTitle}
                                </Link>{" "}
                                <Badge
                                  variant={
                                    request.status === "RELEASED"
                                      ? "default"
                                      : request.status === "REVOKED" ||
                                          request.status === "EXPIRED" ||
                                          request.status === "DECLINED"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="align-middle"
                                >
                                  {REQUEST_STATUS_LABELS[request.status] ??
                                    request.status}
                                </Badge>
                                {request.status === "INVITED" &&
                                  request.graceEndsAt && (
                                    <div className="text-xs text-muted-foreground">
                                      Claim window ends{" "}
                                      {formatDate(request.graceEndsAt)}
                                    </div>
                                  )}
                                {request.status === "CLAIMED_PENDING_CONFIRM" && (
                                  <div className="mt-1.5">
                                    <ClaimReviewActions
                                      requestId={request.id}
                                      assetTitle={request.assetTitle}
                                      nomineeName={nominee.name}
                                    />
                                  </div>
                                )}
                                {request.status === "RELEASED" &&
                                  request.authorization?.status === "ACTIVE" && (
                                    <div className="mt-1">
                                      <AuthorizationRevokeButton
                                        authorizationId={request.authorization.id}
                                        assetTitle={request.assetTitle}
                                        nomineeName={nominee.name}
                                      />
                                    </div>
                                  )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="text-sm">
                          {nominee.authorizationCounts.active} active
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {nominee.authorizationCounts.revoked} revoked
                        </div>
                      </td>
                      <td className="py-4">
                        <NomineeActions
                          nomineeId={nominee.id}
                          name={nominee.name}
                          email={nominee.email}
                          relationship={nominee.relationship ?? ""}
                          status={nominee.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Invitations record a claim window deadline ({process.env.CLAIM_GRACE_PERIOD_DAYS ?? "3"}{" "}
        days). Release and eligibility are separate, deliberate actions — nothing
        happens automatically.
      </p>
    </div>
  );
}

export default function NomineesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading nominees…
          </div>
        </div>
      }
    >
      <NomineesContent />
    </Suspense>
  );
}
