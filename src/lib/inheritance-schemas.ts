import { z } from "zod";

import { fieldErrorsFrom } from "@/lib/asset-schemas";

export { fieldErrorsFrom };

export const requestIdSchema = z
  .string({ error: "Request id is required." })
  .trim()
  .min(1, "Request id is required.")
  .max(64, "Request id is not valid.");

export const authorizationIdSchema = z
  .string({ error: "Authorization id is required." })
  .trim()
  .min(1, "Authorization id is required.")
  .max(64, "Authorization id is not valid.");

const attestationSchema = z.literal(true, {
  error: "You must confirm the acknowledgement to continue.",
});

const claimCodeSchema = z
  .string({ error: "Expected a text value." })
  .trim()
  .min(1, "Claim code is required.")
  .max(128, "Claim code is not valid.");

const reasonSchema = z
  .string({ error: "Expected a text value." })
  .trim()
  .max(500, "Reason must be 500 characters or fewer.")
  .optional();

export const initiateClaimSchema = z.object({
  attestation: attestationSchema,
  claimCode: claimCodeSchema.optional(),
});

export const submitClaimSchema = z.object({
  attestation: attestationSchema,
});

export const declineRequestSchema = z.object({
  reason: reasonSchema,
});

export const rejectClaimSchema = z.object({
  reason: reasonSchema,
});

export type InitiateClaimInput = z.input<typeof initiateClaimSchema>;
export type SubmitClaimInput = z.input<typeof submitClaimSchema>;
export type DeclineRequestInput = z.input<typeof declineRequestSchema>;
export type RejectClaimInput = z.input<typeof rejectClaimSchema>;
