"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  Bitcoin,
  Check,
  Cloud,
  CreditCard,
  Gamepad2,
  Globe,
  Image as ImageIcon,
  Key,
  Loader2,
  Package,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { ASSET_CATEGORIES, ASSET_STATUSES, CATEGORY_LABELS } from "@/lib/asset-schemas";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type AssetFormInitial = {
  title: string;
  category: string;
  providerName: string;
  estimatedValue: string;
  currency: string;
  description: string;
  accountReference: string;
  valuationBasis: string;
  officialUrl: string;
  status: string;
  nomineeCanSeeAccountReference: boolean;
};

type AssetFormProps =
  | { mode: "create" }
  | { mode: "edit"; assetId: string; initial: AssetFormInitial };

type ApiErrorResponse = {
  error?: string;
  fields?: Record<string, string>;
  id?: string;
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  CRYPTO: Bitcoin,
  DOMAIN: Globe,
  CLOUD_STORAGE: Cloud,
  INVESTMENT: TrendingUp,
  GAMING: Gamepad2,
  DIGITAL_CONTENT: ImageIcon,
  SOCIAL_MEDIA: AtSign,
  PAYMENT_ACCOUNT: CreditCard,
  SOFTWARE_LICENSE: Key,
  OTHER: Package,
};

// Display-only, one-line guidance for each category.
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  CRYPTO: "Wallets, holdings and digital tokens",
  INVESTMENT: "Brokerage accounts, shares and platforms",
  DOMAIN: "Domains, hosting and websites",
  GAMING: "Game accounts, libraries and in-game holdings",
  DIGITAL_CONTENT: "NFTs and purchased digital collections",
  CLOUD_STORAGE: "Cloud drives and document repositories",
  SOFTWARE_LICENSE: "Software and licences you own",
  OTHER: "Digital property that fits elsewhere",
  SOCIAL_MEDIA: "Profiles and handles, for your nominee's reference",
  PAYMENT_ACCOUNT: "Payment services, for your nominee's reference",
};

// The eight core inheritance categories shown prominently.
const PRIMARY_CATEGORIES = [
  "CRYPTO",
  "INVESTMENT",
  "DOMAIN",
  "GAMING",
  "DIGITAL_CONTENT",
  "CLOUD_STORAGE",
  "SOFTWARE_LICENSE",
  "OTHER",
] as const;

// Accounts with provider-TOS limits on transfer: still recordable, but kept
// separate from primary wealth categories so the picker stays honest.
const REFERENCE_CATEGORIES = ["SOCIAL_MEDIA", "PAYMENT_ACCOUNT"] as const;

function CategoryTile({
  value,
  selected,
  onSelect,
}: {
  value: string;
  selected: boolean;
  onSelect: (category: string) => void;
}) {
  const Icon = CATEGORY_ICONS[value] ?? Package;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
        selected
          ? "border-primary bg-secondary"
          : "border-border bg-card hover:bg-accent/50"
      }`}
    >
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {CATEGORY_LABELS[value] ?? value}
          {selected && <Check className="size-3.5 text-primary" aria-hidden="true" />}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {CATEGORY_DESCRIPTIONS[value] ?? ""}
        </span>
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function CategoryPicker({
  selected,
  onSelect,
  onContinue,
}: {
  selected: string;
  onSelect: (category: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Add asset</SectionLabel>
        <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
          What are you adding to your vault?
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Record your digital assets and keep the details your trusted
          nominees will need — clear now, findable later. Values you enter are
          your own estimates.
        </p>
      </div>

      {/* Core categories */}
      <div
        role="radiogroup"
        aria-label="Asset category"
        className="grid gap-3 sm:grid-cols-2"
      >
        {PRIMARY_CATEGORIES.map((value) => (
          <CategoryTile
            key={value}
            value={value}
            selected={selected === value}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Reference accounts — useful to record, not transferable wealth */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Important digital accounts</p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
            Social and payment providers often prohibit transferring accounts.
            Record them so your nominees know they exist — not as wealth you
            expect to be transferred.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Important digital accounts"
          className="grid gap-3 sm:grid-cols-2"
        >
          {REFERENCE_CATEGORIES.map((value) => (
            <CategoryTile
              key={value}
              value={value}
              selected={selected === value}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="ghost" asChild>
          <Link href="/dashboard">Cancel</Link>
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={!selected}
          aria-disabled={!selected}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function AssetForm(props: AssetFormProps) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [step, setStep] = useState<"category" | "details">(
    props.mode === "create" ? "category" : "details",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [providerName, setProviderName] = useState(initial?.providerName ?? "");
  const [estimatedValue, setEstimatedValue] = useState(
    initial?.estimatedValue ?? "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "INR");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [accountReference, setAccountReference] = useState(
    initial?.accountReference ?? "",
  );
  const [valuationBasis, setValuationBasis] = useState(
    initial?.valuationBasis ?? "",
  );
  const [officialUrl, setOfficialUrl] = useState(initial?.officialUrl ?? "");
  const [status, setStatus] = useState(initial?.status ?? "ACTIVE");
  const [nomineeCanSeeAccountReference, setNomineeCanSeeAccountReference] =
    useState(initial?.nomineeCanSeeAccountReference ?? false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = props.mode === "edit";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return; // guard against accidental duplicate submissions
    setFormError(null);
    setFieldErrors({});
    setSaving(true);

    const payload: Record<string, unknown> = {
      title,
      category,
      providerName,
      estimatedValue:
        estimatedValue.trim() === "" ? null : Number(estimatedValue),
      currency,
      description,
      accountReference,
      valuationBasis,
      officialUrl,
    };
    if (isEdit) {
      payload.status = status;
      payload.nomineeCanSeeAccountReference = nomineeCanSeeAccountReference;
    }

    try {
      const response = await fetch(
        isEdit ? `/api/assets/${props.assetId}` : "/api/assets",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;

      if (!response.ok) {
        if (response.status === 400 && data?.fields) {
          setFieldErrors(data.fields);
        }
        setFormError(
          data?.error ??
            (response.status >= 500
              ? "The server could not process this right now. Please try again shortly."
              : "Something went wrong. Please check the form and try again."),
        );
        return;
      }

      const nextId = isEdit ? props.assetId : data?.id;
      router.push(nextId ? `/dashboard/assets/${nextId}` : "/dashboard");
      router.refresh();
    } catch {
      setFormError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isEdit && step === "category") {
    return (
      <Card>
        <CardContent>
          <CategoryPicker
            selected={category}
            onSelect={(value) => {
              setCategory(value);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.category;
                return next;
              });
            }}
            onContinue={() => {
              if (category) {
                setStep("details");
              }
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit asset" : "Add asset"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update your record. Only you can see and change your assets."
            : "Record a digital asset you own. Values are your own estimates."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-10">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {/* A. Asset identity */}
          <section aria-labelledby="section-identity" className="space-y-5">
            <div className="flex items-end justify-between gap-4 border-b border-border pb-2">
              <h3
                id="section-identity"
                className="font-heading text-base font-semibold tracking-tight"
              >
                Asset identity
              </h3>
              {!isEdit && category && (
                <button
                  type="button"
                  onClick={() => setStep("category")}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                  Change category
                </button>
              )}
            </div>

            {!isEdit && category && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  {(() => {
                    const Icon = CATEGORY_ICONS[category] ?? Package;
                    return <Icon className="size-4" aria-hidden="true" />;
                  })()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Selected category
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-title">
                  Asset name <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="asset-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Home lab server"
                  maxLength={100}
                  required
                  aria-invalid={fieldErrors.title ? true : undefined}
                  aria-describedby={
                    fieldErrors.title ? "asset-title-error" : undefined
                  }
                />
                <FieldError id="asset-title-error" message={fieldErrors.title} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-provider">
                  Provider or platform <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="asset-provider"
                  value={providerName}
                  onChange={(event) => setProviderName(event.target.value)}
                  placeholder="e.g. Steam, GoDaddy, Zerodha"
                  maxLength={120}
                  required
                  aria-invalid={fieldErrors.providerName ? true : undefined}
                  aria-describedby={
                    fieldErrors.providerName
                      ? "asset-provider-error"
                      : undefined
                  }
                />
                <FieldError
                  id="asset-provider-error"
                  message={fieldErrors.providerName}
                />
              </div>

              {/* Category select for edit mode; create mode uses the picker */}
              <div className={`space-y-2 ${!isEdit ? "hidden" : ""}`}>
                <Label htmlFor="asset-category">
                  Category <span aria-hidden="true">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger
                    id="asset-category"
                    aria-invalid={fieldErrors.category ? true : undefined}
                    aria-describedby={
                      fieldErrors.category
                        ? "asset-category-error"
                        : undefined
                    }
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CATEGORY_LABELS[value] ?? value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError
                  id="asset-category-error"
                  message={fieldErrors.category}
                />
              </div>
            </div>
          </section>

          {/* B. Estimated value */}
          <section aria-labelledby="section-value" className="space-y-5">
            <div className="border-b border-border pb-2">
              <h3
                id="section-value"
                className="font-heading text-base font-semibold tracking-tight"
              >
                Estimated value
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Your own estimate, not a live valuation — currencies are kept
                separate and never combined.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-value">
                  Estimated value <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="asset-value"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={estimatedValue}
                  onChange={(event) => setEstimatedValue(event.target.value)}
                  placeholder="0.00"
                  required
                  aria-invalid={fieldErrors.estimatedValue ? true : undefined}
                  aria-describedby={
                    fieldErrors.estimatedValue
                      ? "asset-value-error"
                      : undefined
                  }
                />
                <FieldError
                  id="asset-value-error"
                  message={fieldErrors.estimatedValue}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-currency">
                  Currency <span aria-hidden="true">*</span>
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger
                    id="asset-currency"
                    aria-invalid={fieldErrors.currency ? true : undefined}
                    aria-describedby={
                      fieldErrors.currency ? "asset-currency-error" : undefined
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError
                  id="asset-currency-error"
                  message={fieldErrors.currency}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="asset-valuation-basis">Valuation basis</Label>
                <Input
                  id="asset-valuation-basis"
                  value={valuationBasis}
                  onChange={(event) => setValuationBasis(event.target.value)}
                  placeholder="e.g. Recent marketplace listing"
                  maxLength={300}
                  aria-invalid={fieldErrors.valuationBasis ? true : undefined}
                  aria-describedby={
                    fieldErrors.valuationBasis
                      ? "asset-valuation-basis-error"
                      : "asset-valuation-basis-help"
                  }
                />
                <p
                  id="asset-valuation-basis-help"
                  className="text-xs text-muted-foreground"
                >
                  Optional. How you arrived at the estimate — useful context
                  for your nominees.
                </p>
                <FieldError
                  id="asset-valuation-basis-error"
                  message={fieldErrors.valuationBasis}
                />
              </div>
            </div>
          </section>

          {/* C. Helpful details */}
          <section aria-labelledby="section-details" className="space-y-5">
            <div className="border-b border-border pb-2">
              <h3
                id="section-details"
                className="font-heading text-base font-semibold tracking-tight"
              >
                Helpful details
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional context that helps a trusted person identify and
                verify this asset. Never store passwords or secrets here.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="asset-description">Description</Label>
                <Textarea
                  id="asset-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What this asset is and why you own it"
                  maxLength={2000}
                  rows={3}
                  aria-invalid={fieldErrors.description ? true : undefined}
                  aria-describedby={
                    fieldErrors.description
                      ? "asset-description-error"
                      : "asset-description-help"
                  }
                />
                <p
                  id="asset-description-help"
                  className="text-xs text-muted-foreground"
                >
                  Optional.
                </p>
                <FieldError
                  id="asset-description-error"
                  message={fieldErrors.description}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-account-ref">Account identifier</Label>
                <Input
                  id="asset-account-ref"
                  value={accountReference}
                  onChange={(event) => setAccountReference(event.target.value)}
                  placeholder="e.g. @handle or user id"
                  maxLength={200}
                  aria-invalid={fieldErrors.accountReference ? true : undefined}
                  aria-describedby={
                    fieldErrors.accountReference
                      ? "asset-account-ref-error"
                      : "asset-account-ref-help"
                  }
                />
                <p
                  id="asset-account-ref-help"
                  className="text-xs text-muted-foreground"
                >
                  Optional. Never enter passwords, recovery codes or seed
                  phrases.
                </p>
                <FieldError
                  id="asset-account-ref-error"
                  message={fieldErrors.accountReference}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-official-url">Official provider URL</Label>
                <Input
                  id="asset-official-url"
                  type="url"
                  value={officialUrl}
                  onChange={(event) => setOfficialUrl(event.target.value)}
                  placeholder="https://example.com"
                  maxLength={500}
                  aria-invalid={fieldErrors.officialUrl ? true : undefined}
                  aria-describedby={
                    fieldErrors.officialUrl
                      ? "asset-official-url-error"
                      : "asset-official-url-help"
                  }
                />
                <p
                  id="asset-official-url-help"
                  className="text-xs text-muted-foreground"
                >
                  Optional.{" "}
                  {isEdit
                    ? "Clear the field to remove the link."
                    : "A link to the provider's official page."}
                </p>
                <FieldError
                  id="asset-official-url-error"
                  message={fieldErrors.officialUrl}
                />
              </div>
            </div>
          </section>

          {/* Edit-only: status and nominee visibility */}
          {isEdit && (
            <section aria-labelledby="section-status" className="space-y-5">
              <div className="border-b border-border pb-2">
                <h3
                  id="section-status"
                  className="font-heading text-base font-semibold tracking-tight"
                >
                  Status &amp; nominee visibility
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asset-status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger
                      id="asset-status"
                      aria-invalid={fieldErrors.status ? true : undefined}
                      aria-describedby={
                        fieldErrors.status ? "asset-status-error" : undefined
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value === "ACTIVE" ? "Active" : "Archived"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError
                    id="asset-status-error"
                    message={fieldErrors.status}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label
                    htmlFor="asset-nominee-account-ref"
                    className="flex items-start gap-2"
                  >
                    <Checkbox
                      id="asset-nominee-account-ref"
                      checked={nomineeCanSeeAccountReference}
                      onCheckedChange={(value) =>
                        setNomineeCanSeeAccountReference(value === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="text-sm leading-none font-medium">
                      Show account identifier to nominees after release
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Off by default. When off, a nominee&apos;s released
                    recovery view never includes the account identifier — only
                    recovery instructions, ownership evidence, official links
                    and the asset title.
                  </p>
                </div>
              </div>
            </section>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
            {!isEdit && (
              <button
                type="button"
                onClick={() => setStep("category")}
                className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to categories
              </button>
            )}
            <Button type="button" variant="ghost" asChild>
              <Link href={isEdit ? `/dashboard/assets/${props.assetId}` : "/dashboard"}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Add asset"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
