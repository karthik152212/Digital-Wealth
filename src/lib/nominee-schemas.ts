import { z } from "zod";

import { fieldErrorsFrom } from "@/lib/asset-schemas";

export { fieldErrorsFrom };

export const NOMINEE_STATUSES = ["ACTIVE", "REVOKED"] as const;

export type NomineeStatusValue = (typeof NOMINEE_STATUSES)[number];

export const nomineeIdSchema = z
  .string({ error: "Nominee id is required." })
  .trim()
  .min(1, "Nominee id is required.")
  .max(64, "Nominee id is not valid.");

const nameSchema = z
  .string({ error: "Nominee name is required." })
  .trim()
  .min(1, "Nominee name is required.")
  .max(80, "Nominee name must be 80 characters or fewer.");

const emailSchema = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .max(254, "Email must be 254 characters or fewer.")
  .refine(
    (value) => z.email().safeParse(value).success,
    "Enter a valid email address.",
  );

const relationshipSchema = z
  .string({ error: "Expected a text value." })
  .trim()
  .max(80, "Relationship must be 80 characters or fewer.")
  .optional();

export const createNomineeSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  relationship: relationshipSchema,
});

export const updateNomineeSchema = z
  .object({
    name: nameSchema.optional(),
    relationship: relationshipSchema,
    status: z.enum(["ACTIVE"], {
      error:
        "Status can only be set to ACTIVE here; use the revoke action to revoke.",
    }).optional(),
    email: z
      .string({ error: "Email cannot be changed after creation." })
      .refine(() => false, "Email cannot be changed after creation.")
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.relationship !== undefined ||
      data.status !== undefined,
    { error: "Provide at least one field to update." },
  );

export const inviteRequestSchema = z.object({
  nomineeId: nomineeIdSchema,
});

export type CreateNomineeInput = z.input<typeof createNomineeSchema>;
export type UpdateNomineeInput = z.input<typeof updateNomineeSchema>;
export type InviteRequestInput = z.input<typeof inviteRequestSchema>;
