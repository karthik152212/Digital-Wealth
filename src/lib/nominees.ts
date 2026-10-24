import { randomUUID } from "node:crypto";

import { generateClaimCode, hashClaimCode } from "@/lib/claim-code";
import { prisma } from "@/lib/prisma";
import type { CreateNomineeInput, UpdateNomineeInput } from "@/lib/nominee-schemas";

const OPEN_REQUEST_STATUSES = [
  "INVITED",
  "ELIGIBLE",
  "CLAIMED_PENDING_CONFIRM",
] as const;

function normalizedRelationship(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function gracePeriodMs(): number {
  const parsed = Number(process.env.CLAIM_GRACE_PERIOD_DAYS);
  const days = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 3;
  return days * 24 * 60 * 60 * 1000;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function listNominees(ownerId: string) {
  const nominees = await prisma.nominee.findMany({
    where: { ownerId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      inheritanceRequests: {
        where: { asset: { ownerId } },
        orderBy: { invitedAt: "desc" },
        include: { asset: { select: { id: true, title: true } } },
      },
      authorizations: {
        select: { id: true, status: true, assetId: true, attempt: true },
      },
    },
  });

  return nominees.map((nominee) => {
    const activeAuthorizations = nominee.authorizations.filter(
      (authorization) => authorization.status === "ACTIVE",
    ).length;
    return {
      id: nominee.id,
      name: nominee.name,
      email: nominee.email,
      relationship: nominee.relationship,
      status: nominee.status,
      revokedAt: nominee.revokedAt,
      isDemo: nominee.isDemo,
      createdAt: nominee.createdAt,
      requests: nominee.inheritanceRequests.map((request) => {
        const matching = nominee.authorizations.filter(
          (candidate) =>
            candidate.assetId === request.asset.id &&
            candidate.attempt === request.attempt,
        );
        const authorization =
          matching.find((candidate) => candidate.status === "ACTIVE") ??
          matching[0] ??
          null;
        return {
          id: request.id,
          assetId: request.asset.id,
          assetTitle: request.asset.title,
          status: request.status,
          attempt: request.attempt,
          invitedAt: request.invitedAt,
          graceEndsAt: request.graceEndsAt,
          eligibleAt: request.eligibleAt,
          claimedAt: request.claimedAt,
          releasedAt: request.releasedAt,
          authorization: authorization
            ? { id: authorization.id, status: authorization.status }
            : null,
        };
      }),
      authorizationCounts: {
        active: activeAuthorizations,
        revoked: nominee.authorizations.length - activeAuthorizations,
      },
    };
  });
}

export type CreateNomineeResult =
  | { ok: true; id: string }
  | { ok: false; conflict: "NOMINEE_EXISTS" | "NOMINEE_REVOKED" };

export async function createNominee(
  ownerId: string,
  input: CreateNomineeInput,
): Promise<CreateNomineeResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.nominee.findUnique({
    where: { ownerId_email: { ownerId, email } },
    select: { status: true },
  });
  if (existing) {
    return existing.status === "ACTIVE"
      ? { ok: false, conflict: "NOMINEE_EXISTS" }
      : { ok: false, conflict: "NOMINEE_REVOKED" };
  }

  try {
    const nominee = await prisma.nominee.create({
      data: {
        id: randomUUID(),
        ownerId,
        name: input.name.trim(),
        email,
        relationship: normalizedRelationship(input.relationship),
        isDemo: false,
      },
      select: { id: true },
    });
    return { ok: true, id: nominee.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await prisma.nominee.findUnique({
        where: { ownerId_email: { ownerId, email } },
        select: { status: true },
      });
      if (raced?.status === "REVOKED") {
        return { ok: false, conflict: "NOMINEE_REVOKED" };
      }
      return { ok: false, conflict: "NOMINEE_EXISTS" };
    }
    throw error;
  }
}

export type UpdateNomineeResult = "updated" | "not_found";

export async function updateNominee(
  ownerId: string,
  nomineeId: string,
  input: UpdateNomineeInput,
): Promise<UpdateNomineeResult> {
  const data: {
    name?: string;
    relationship?: string | null;
    status?: "ACTIVE";
    revokedAt?: null;
  } = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.relationship !== undefined) {
    data.relationship = normalizedRelationship(input.relationship) ?? null;
  }
  if (input.status === "ACTIVE") {
    data.status = "ACTIVE";
    data.revokedAt = null;
  }

  const { count } = await prisma.nominee.updateMany({
    where: { id: nomineeId, ownerId },
    data,
  });
  return count === 1 ? "updated" : "not_found";
}

export type RevokeNomineeResult =
  | {
      ok: true;
      alreadyRevoked: boolean;
      revokedRequests: number;
      revokedAuthorizations: number;
    }
  | { ok: false; reason: "not_found" };

export async function revokeNominee(
  ownerId: string,
  nomineeId: string,
): Promise<RevokeNomineeResult> {
  return prisma.$transaction(async (tx) => {
    const nominee = await tx.nominee.findFirst({
      where: { id: nomineeId, ownerId },
      select: { id: true },
    });
    if (!nominee) {
      return { ok: false, reason: "not_found" } as const;
    }

    const now = new Date();
    const revoked = await tx.nominee.updateMany({
      where: { id: nominee.id, ownerId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });
    if (revoked.count === 0) {
      return {
        ok: true,
        alreadyRevoked: true,
        revokedRequests: 0,
        revokedAuthorizations: 0,
      } as const;
    }

    const authorizations = await tx.assetAuthorization.updateMany({
      where: { nomineeId: nominee.id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });

    const openRequests = await tx.inheritanceRequest.findMany({
      where: {
        nomineeId: nominee.id,
        status: { in: [...OPEN_REQUEST_STATUSES] },
        asset: { ownerId },
      },
      select: { id: true },
    });

    for (const request of openRequests) {
      await tx.inheritanceRequest.update({
        where: { id: request.id },
        data: { status: "REVOKED" },
      });
      await tx.inheritanceEvent.create({
        data: {
          id: randomUUID(),
          requestId: request.id,
          actorId: ownerId,
          action: "REVOKED",
          note: "Owner revoked the nominee relationship.",
        },
      });
    }

    return {
      ok: true,
      alreadyRevoked: false,
      revokedRequests: openRequests.length,
      revokedAuthorizations: authorizations.count,
    } as const;
  });
}

export type InviteToAssetResult =
  | { ok: true; requestId: string; claimCode: string }
  | { ok: false; reason: "asset_not_found" | "nominee_not_found" }
  | { ok: false; conflict: "NOMINEE_REVOKED" | "REQUEST_EXISTS" };

export async function inviteToAsset(
  ownerId: string,
  assetId: string,
  nomineeId: string,
): Promise<InviteToAssetResult> {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findFirst({
      where: { id: assetId, ownerId },
      select: { id: true, title: true },
    });
    if (!asset) {
      return { ok: false, reason: "asset_not_found" } as const;
    }

    const nominee = await tx.nominee.findFirst({
      where: { id: nomineeId, ownerId },
      select: { id: true, email: true, status: true },
    });
    if (!nominee) {
      return { ok: false, reason: "nominee_not_found" } as const;
    }
    if (nominee.status !== "ACTIVE") {
      return { ok: false, conflict: "NOMINEE_REVOKED" } as const;
    }

    const openRequest = await tx.inheritanceRequest.findFirst({
      where: {
        assetId,
        nomineeId,
        status: { in: ["INVITED", "ELIGIBLE", "CLAIMED_PENDING_CONFIRM"] },
      },
      select: { id: true },
    });
    if (openRequest) {
      return { ok: false, conflict: "REQUEST_EXISTS" } as const;
    }

    const lastAttempt = await tx.inheritanceRequest.findFirst({
      where: { assetId, nomineeId },
      orderBy: { attempt: "desc" },
      select: { attempt: true },
    });
    const claimCode = generateClaimCode();
    const now = new Date();
    const request = await tx.inheritanceRequest.create({
      data: {
        id: randomUUID(),
        assetId,
        nomineeId,
        invitedById: ownerId,
        attempt: (lastAttempt?.attempt ?? 0) + 1,
        status: "INVITED",
        invitedAt: now,
        graceEndsAt: new Date(now.getTime() + gracePeriodMs()),
        claimCodeHash: hashClaimCode(claimCode),
        isDemo: false,
      },
      select: { id: true },
    });

    await tx.inheritanceEvent.create({
      data: {
        id: randomUUID(),
        requestId: request.id,
        actorId: ownerId,
        action: "INVITED",
        note: "Owner sent an in-app inheritance invitation (simulated).",
      },
    });

    const invitee = await tx.user.findUnique({
      where: { email: nominee.email },
      select: { id: true },
    });
    if (invitee) {
      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId: invitee.id,
          type: "NOMINEE_INVITE",
          title: "New inheritance invitation",
          body: `You have been named a nominee for ${asset.title}.`,
          isDemo: false,
        },
      });
    }

    return { ok: true, requestId: request.id, claimCode } as const;
  });
}
