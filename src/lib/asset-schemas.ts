import { z } from "zod";

import { SUPPORTED_CURRENCIES } from "@/lib/currency";

export const ASSET_CATEGORIES = [
  "CRYPTO",
  "DOMAIN",
  "CLOUD_STORAGE",
  "INVESTMENT",
  "GAMING",
  "DIGITAL_CONTENT",
  "SOCIAL_MEDIA",
  "PAYMENT_ACCOUNT",
  "SOFTWARE_LICENSE",
  "OTHER",
] as const;

export type AssetCategoryValue = (typeof ASSET_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  CRYPTO: "Crypto",
  DOMAIN: "Domains",
  CLOUD_STORAGE: "Cloud Storage",
  INVESTMENT: "Investments",
  GAMING: "Gaming",
  DIGITAL_CONTENT: "Digital Content",
  SOCIAL_MEDIA: "Social Media",
  PAYMENT_ACCOUNT: "Payment Accounts",
  SOFTWARE_LICENSE: "Software Licenses",
  OTHER: "Other",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

const titleSchema = z
  .string({ error: "Asset name is required." })
  .trim()
  .min(1, "Asset name is required.")
  .max(100, "Asset name must be 100 characters or fewer.");

const providerNameSchema = z
  .string({ error: "Provider or platform is required." })
  .trim()
  .min(1, "Provider or platform is required.")
  .max(120, "Provider or platform must be 120 characters or fewer.");

const categorySchema = z.enum(ASSET_CATEGORIES, {
  error: "Choose one of the supported asset categories.",
});

const currencySchema = z.enum(SUPPORTED_CURRENCIES, {
  error: "Choose one of the supported currencies.",
});

const estimatedValueSchema = z
  .number({ error: "Enter a valid estimated value." })
  .refine(Number.isFinite, "Estimated value must be a finite number.")
  .min(0, "Estimated value cannot be negative.")
  .max(9_999_999_999.99, "Estimated value exceeds the supported limit.")
  .transform((value) => Math.round(value * 100) / 100);

function optionalText(max: number) {
  return z
    .string({ error: "Expected a text value." })
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const officialUrlSchema = z
  .string({ error: "Expected a URL value." })
  .trim()
  .max(500, "Official URL must be 500 characters or fewer.")
  .refine(
    (value) => value === "" || isHttpUrl(value),
    "Enter a valid URL starting with http:// or https://.",
  )
  .optional();

const descriptionSchema = optionalText(2000);
const accountReferenceSchema = optionalText(200);
const valuationBasisSchema = optionalText(300);

export const createAssetSchema = z.object({
  title: titleSchema,
  category: categorySchema,
  providerName: providerNameSchema,
  estimatedValue: estimatedValueSchema,
  currency: currencySchema,
  description: descriptionSchema,
  accountReference: accountReferenceSchema,
  valuationBasis: valuationBasisSchema,
  officialUrl: officialUrlSchema,
});

export const ASSET_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

export const updateAssetSchema = createAssetSchema
  .partial()
  .extend({
    status: z.enum(ASSET_STATUSES, {
      error: "Choose either active or archived.",
    }).optional(),
    nomineeCanSeeAccountReference: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { error: "Provide at least one field to update." },
  );

export const assetIdSchema = z
  .string({ error: "Asset id is required." })
  .trim()
  .min(1, "Asset id is required.")
  .max(64, "Asset id is not valid.");

export type CreateAssetInput = z.input<typeof createAssetSchema>;
export type UpdateAssetInput = z.input<typeof updateAssetSchema>;

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}
