import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  MAX_CLAIM_CODE_ATTEMPTS,
  verifyClaimCode,
} from "@/lib/claim-code";
import type {
  DeclineRequestInput,
  InitiateClaimInput,
  RejectClaimInput,
} from "@/lib/inheritance-schemas";

const OPEN_REQUEST_STATUSES = [
  "INVITED",
  "ELIGIBLE",
  "CLAIMED_PENDING_CONFIRM",
] as const;

export type TransitionConflictCode =
  | "INVALID_STATE"
  | "EXPIRED"
  | "CLAIM_CODE_REQUIRED"
  | "CLAIM_CODE_INVALID"
  | "CLAIM_CODE_LOCKED";

function lower(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Nominee side — list & claim workflow
// ---------------------------------------------------------------------------

export async function listMyInheritance(sessionEmail: string) {
  const email = lower(sessionEmail);
  const nominees = await prisma.nominee.findMany({
    where: { email },
    select: { id: true },
  });
  if (nominees.length === 0) return [];

  const requests = await prisma.inheritanceRequest.findMany({
    where: { nomineeId: { in: nominees.map((n) => n.id) } },
    orderBy: { invitedAt: "desc" },
    include: {
      asset: { select: { id: true, title: true, category: true } },
      nominee: { select: { id: true, name: true, status: true } },
      invitedByUser: { select: { id: true, name: true } },
    },
  });

  const activeAuthorizations = await prisma.assetAuthorization.findMany({
    where: {
      nomineeId: { in: nominees.map((n) => n.id) },
      status: "ACTIVE",
    },
    select: { assetId: true, nomineeId: true, attempt: true },
  });
  const activeKeys = new Set(
    activeAuthorizations.map(
      (a) => `${a.assetId}:${a.nomineeId}:${a.attempt}`,
    ),
  );

  const now = Date.now();
  return requests.map((request) => {
    const expired =
      request.status === "INVITED" && request.graceEndsAt.getTime() < now;
    const authorizationActive =
      request.status === "RELEASED" &&
      activeKeys.has(`${request.assetId}:${request.nominee.id}:${request.attempt}`);
    return {
      id: request.id,
      assetId: request.asset.id,
      assetTitle: request.asset.title,
      assetCategory: request.asset.category,
      ownerName: request.invitedByUser.name,
      nomineeId: request.nominee.id,
      nomineeName: request.nominee.name,
      nomineeStatus: request.nominee.status,
      status: request.status,
      expired,
      attempt: request.attempt,
      authorizationActive,
      invitedAt: request.invitedAt,
      graceEndsAt: request.graceEndsAt,
      eligibleAt: request.eligibleAt,
      claimedAt: request.claimedAt,
      releasedAt: request.releasedAt,
      declineReason: request.declineReason,
      claimCodeRequired: request.claimCodeHash !== null,
      canClaim: request.status === "INVITED" && !expired,
      canSubmit: request.status === "ELIGIBLE",
      canDecline:
        request.status === "INVITED" ||
        request.status === "ELIGIBLE" ||
        request.status === "CLAIMED_PENDING_CONFIRM",
    };
  });
}

export type ClaimResult =
  | { ok: true; status: "ELIGIBLE" | "CLAIMED_PENDING_CONFIRM" | "DECLINED" }
  | { ok: false; reason: "not_found" }
  | { ok: false; conflict: TransitionConflictCode };

export async function initiateClaim(
  sessionUserId: string,
  sessionEmail: string,
  requestId: string,
  input: InitiateClaimInput,
): Promise<ClaimResult> {
  const email = lower(sessionEmail);
  return prisma.$transaction(async (tx) => {
    const request = await tx.inheritanceRequest.findFirst({
      where: { id: requestId, nominee: { email } },
      select: { id: true, status: true, graceEndsAt: true, claimCodeHash: true, claimCodeAttempts: true },
    });
    if (!request) {
      return { ok: false, reason: "not_found" } as const;
    }

    if (request.status === "INVITED" && request.graceEndsAt.getTime() < Date.now()) {
      const expired = await tx.inheritanceRequest.updateMany({
        where: { id: request.id, status: "INVITED" },
        data: { status: "EXPIRED" },
      });
      if (expired.count === 1) {
        await tx.inheritanceEvent.create({
          data: {
            id: randomUUID(),
            requestId: request.id,
            actorId: null,
            action: "EXPIRED",
            note: "Invitation window elapsed before any claim. Expiry is not confirmation of death; no access was granted.",
          },
        });
      }
      return { ok: false, conflict: "EXPIRED" } as const;
    }

    if (request.status !== "INVITED") {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    let codeVerified = false;
    if (request.claimCodeHash) {
      if (request.claimCodeAttempts >= MAX_CLAIM_CODE_ATTEMPTS) {
        return { ok: false, conflict: "CLAIM_CODE_LOCKED" } as const;
      }
      if (!input.claimCode) {
        return { ok: false, conflict: "CLAIM_CODE_REQUIRED" } as const;
      }
      if (!verifyClaimCode(input.claimCode, request.claimCodeHash)) {
        await tx.inheritanceRequest.update({
          where: { id: request.id },
          data: { claimCodeAttempts: { increment: 1 } },
        });
        return { ok: false, conflict: "CLAIM_CODE_INVALID" } as const;
      }
      codeVerified = true;
    }

    const now = new Date();
    const transitioned = await tx.inheritanceRequest.updateMany({
      where: { id: request.id, status: "INVITED" },
      data: {
        status: "ELIGIBLE",
        eligibleAt: now,
        ...(codeVerified ? { claimCodeHash: null } : {}),
      },
    });
    if (transitioned.count === 0) {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    await tx.inheritanceEvent.create({
      data: {
        id: randomUUID(),
        requestId: request.id,
        actorId: sessionUserId,
        action: "ELIGIBILITY_MET",
        note: codeVerified
          ? "Nominee asserted a claim with the owner-issued claim code and acknowledged the verification terms. Access is NOT granted."
          : "Nominee asserted a claim from their authenticated account and acknowledged the verification terms. Access is NOT granted.",
      },
    });

    return { ok: true, status: "ELIGIBLE" } as const;
  });
}

export async function submitClaim(
  sessionUserId: string,
  sessionEmail: string,
  requestId: string,
): Promise<ClaimResult> {
  const email = lower(sessionEmail);
  return prisma.$transaction(async (tx) => {
    const request = await tx.inheritanceRequest.findFirst({
      where: { id: requestId, nominee: { email } },
      select: { id: true, status: true },
    });
    if (!request) {
      return { ok: false, reason: "not_found" } as const;
    }
    if (request.status !== "ELIGIBLE") {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    const now = new Date();
    const transitioned = await tx.inheritanceRequest.updateMany({
      where: { id: request.id, status: "ELIGIBLE" },
      data: { status: "CLAIMED_PENDING_CONFIRM", claimedAt: now },
    });
    if (transitioned.count === 0) {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    await tx.inheritanceEvent.create({
      data: {
        id: randomUUID(),
        requestId: request.id,
        actorId: sessionUserId,
        action: "CLAIM_STARTED",
        note: "Nominee submitted the claim; it now awaits the owner's confirmation.",
      },
    });
    await tx.inheritanceEvent.create({
      data: {
        id: randomUUID(),
        requestId: request.id,
        actorId: sessionUserId,
        action: "IDENTITY_RECONFIRMED",
        note: "Nominee re-authenticated and acknowledged that inactivity is not confirmation of death and that this prototype establishes no legal entitlement.",
      },
    });

    return { ok: true, status: "CLAIMED_PENDING_CONFIRM" } as const;
  });
}

export async function declineRequest(
  sessionUserId: string,
  sessionEmail: string,
  requestId: string,
  input: DeclineRequestInput,
): Promise<ClaimResult> {
  const email = lower(sessionEmail);
  const reason = input.reason?.trim();
  return prisma.$transaction(async (tx) => {
    const request = await tx.inheritanceRequest.findFirst({
      where: { id: requestId, nominee: { email } },
      select: { id: true, status: true },
    });
    if (!request) {
      return { ok: false, reason: "not_found" } as const;
    }
    if (!(OPEN_REQUEST_STATUSES as readonly string[]).includes(request.status)) {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    const transitioned = await tx.inheritanceRequest.updateMany({
      where: {
        id: request.id,
        status: { in: [...OPEN_REQUEST_STATUSES] },
      },
      data: {
        status: "DECLINED",
        declineReason: reason && reason !== "" ? reason : null,
      },
    });
    if (transitioned.count === 0) {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    await tx.inheritanceEvent.create({
      data: {
        id: randomUUID(),
        requestId: request.id,
        actorId: sessionUserId,
        action: "DECLINED",
        note: reason && reason !== ""
          ? `Nominee declined the invitation. Reason: ${reason}`
          : "Nominee declined the invitation. No access was granted.",
      },
    });

    return { ok: true, status: "DECLINED" } as const;
  });
}

// ---------------------------------------------------------------------------
// Owner side — approval, rejection, authorization revocation
// ---------------------------------------------------------------------------

export type OwnerActionResult =
  | { ok: true; alreadyDone?: boolean }
  | { ok: false; reason: "not_found" }
  | { ok: false; conflict: TransitionConflictCode | "CLAIM_CODE_CONFLICT" };

export type ApproveResult =
  | { ok: true; authorizationId: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; conflict: TransitionConflictCode };

export async function approveClaim(
  ownerUserId: string,
  requestId: string,
): Promise<ApproveResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.inheritanceRequest.findFirst({
      where: { id: requestId, asset: { ownerId: ownerUserId } },
      include: {
        asset: { select: { id: true, title: true } },
        nominee: { select: { id: true, email: true } },
      },
    });
    if (!request) {
      return { ok: false, reason: "not_found" } as const;
    }
    if (request.status !== "CLAIMED_PENDING_CONFIRM") {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    const now = new Date();
    const authorizationId = randomUUID();
    const transitioned = await tx.inheritanceRequest.updateMany({
      where: { id: request.id, status: "CLAIMED_PENDING_CONFIRM" },
      data: { status: "RELEASED", releasedAt: now },
    });
    if (transitioned.count === 0) {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    await tx.assetAuthorization.create({
      data: {
        id: authorizationId,
        assetId: request.asset.id,
        nomineeId: request.nominee.id,
        grantedBy: ownerUserId,
        attempt: request.attempt,
        status: "ACTIVE",
        isDemo: request.isDemo,
      },
    });

    await tx.inheritanceEvent.create({
      data: {
        id: randomUUID(),
        requestId: request.id,
        actorId: ownerUserId,
        action: "RELEASED",
        note: `Owner approved the claim and released guidance-only authorization ${authorizationId} for this asset.`,
      },
    });

    const invitee = await tx.user.findUnique({
      where: { email: request.nominee.email },
      select: { id: true },
    });
    if (invitee) {
      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId: invitee.id,
          type: "ACCESS_RELEASED",
          title: "Simulated access released",
          body: `Guidance-only access to ${request.asset.title} has been released after the owner approved your claim.`,
          isDemo: request.isDemo,
        },
      });
    }

    return { ok: true, authorizationId } as const;
  });
}

export async function rejectClaim(
  ownerUserId: string,
  requestId: string,
  input: RejectClaimInput,
): Promise<OwnerActionResult> {
  const reason = input.reason?.trim();
  return prisma.$transaction(async (tx) => {
    const request = await tx.inheritanceRequest.findFirst({
      where: { id: requestId, asset: { ownerId: ownerUserId } },
      select: { id: true, status: true },
    });
    if (!request) {
      return { ok: false, reason: "not_found" } as const;
    }
    if (request.status !== "CLAIMED_PENDING_CONFIRM") {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    const transitioned = await tx.inheritanceRequest.updateMany({
      where: { id: request.id, status: "CLAIMED_PENDING_CONFIRM" },
      data: {
        status: "DECLINED",
        declineReason: reason && reason !== "" ? reason : null,
      },
    });
    if (transitioned.count === 0) {
      return { ok: false, conflict: "INVALID_STATE" } as const;
    }

    await tx.inheritanceEvent.create({
      data: {
        id: randomUUID(),
        requestId: request.id,
        actorId: ownerUserId,
        action: "DECLINED",
        note: reason && reason !== ""
          ? `Owner rejected the claim while still in control. Reason: ${reason}`
          : "Owner rejected the claim while still in control. No access was granted.",
      },
    });

    return { ok: true } as const;
  });
}

export async function revokeAuthorization(
  ownerUserId: string,
  authorizationId: string,
): Promise<OwnerActionResult> {
  return prisma.$transaction(async (tx) => {
    const authorization = await tx.assetAuthorization.findFirst({
      where: { id: authorizationId, asset: { ownerId: ownerUserId } },
      include: {
        asset: { select: { id: true, title: true } },
        nominee: { select: { email: true } },
      },
    });
    if (!authorization) {
      return { ok: false, reason: "not_found" } as const;
    }
    if (authorization.status === "REVOKED") {
      return { ok: true, alreadyDone: true } as const;
    }

    const revoked = await tx.assetAuthorization.updateMany({
      where: { id: authorization.id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      return { ok: true, alreadyDone: true } as const;
    }

    const request = await tx.inheritanceRequest.findFirst({
      where: {
        assetId: authorization.assetId,
        nomineeId: authorization.nomineeId,
        attempt: authorization.attempt,
      },
      select: { id: true },
    });
    if (request) {
      await tx.inheritanceEvent.create({
        data: {
          id: randomUUID(),
          requestId: request.id,
          actorId: ownerUserId,
          action: "REVOKED",
          note: `Owner revoked the guidance-only authorization for this asset (${authorization.id}).`,
        },
      });
    }

    const invitee = await tx.user.findUnique({
      where: { email: authorization.nominee.email },
      select: { id: true },
    });
    if (invitee) {
      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId: invitee.id,
          type: "AUTHORIZATION_CHANGED",
          title: "Nominee access revoked",
          body: `The owner revoked your guidance-only access to ${authorization.asset.title}.`,
          isDemo: authorization.isDemo,
        },
      });
    }

    return { ok: true } as const;
  });
}

// ---------------------------------------------------------------------------
// Nominee access — released asset recovery view (strict whitelist)
// ---------------------------------------------------------------------------

export async function getReleasedAssetForNominee(
  sessionEmail: string,
  assetId: string,
) {
  const email = lower(sessionEmail);
  const request = await prisma.inheritanceRequest.findFirst({
    where: { assetId, status: "RELEASED", nominee: { email } },
    include: {
      asset: {
        select: {
          id: true,
          title: true,
          category: true,
          providerName: true,
          accountReference: true,
          nomineeCanSeeAccountReference: true,
          recoveryInstructions: true,
          ownershipEvidence: true,
          isDemo: true,
          officialLinks: { select: { label: true, url: true, type: true } },
        },
      },
      nominee: { select: { id: true } },
    },
  });
  if (!request) return null;

  const authorization = await prisma.assetAuthorization.findFirst({
    where: {
      assetId,
      nomineeId: request.nominee.id,
      attempt: request.attempt,
      status: "ACTIVE",
    },
    select: { id: true, grantedAt: true },
  });
  if (!authorization) return null;

  return {
    authorizationId: authorization.id,
    releasedAt: request.releasedAt,
    attempt: request.attempt,
    asset: {
      id: request.asset.id,
      title: request.asset.title,
      category: request.asset.category,
      providerName: request.asset.providerName,
      recoveryInstructions: request.asset.recoveryInstructions,
      ownershipEvidence: request.asset.ownershipEvidence,
      isDemo: request.asset.isDemo,
      accountReference: request.asset.nomineeCanSeeAccountReference
        ? request.asset.accountReference
        : null,
      officialLinks: request.asset.officialLinks,
    },
  };
}
