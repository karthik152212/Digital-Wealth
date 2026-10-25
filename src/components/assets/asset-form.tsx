"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  Bitcoin,
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

function CategoryPicker({
  selected,
  onSelect,
  onCancel,
}: {
  selected: string;
  onSelect: (category: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-heading text-lg font-semibold tracking-tight">
          What kind of asset is this?
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choosing a category shapes the details you&apos;ll enter next.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Asset category"
        className="grid gap-3 sm:grid-cols-2"
      >
        {ASSET_CATEGORIES.map((value) => {
          const Icon = CATEGORY_ICONS[value] ?? Package;
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(value)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                isSelected
                  ? "border-primary bg-secondary"
                  : "bg-card hover:bg-accent/60"
              }`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <span className="font-medium">
                {CATEGORY_LABELS[value] ?? value}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" asChild>
          <Link href="/dashboard">Cancel</Link>
        </Button>
        <Button type="button" onClick={onCancel} disabled={!selected}>
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
        setFormError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      const nextId = isEdit ? props.assetId : data?.id;
      router.push(nextId ? `/dashboard/assets/${nextId}` : "/dashboard");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isEdit && step === "category") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add asset</CardTitle>
          <CardDescription>
            Record a digital asset you own. Values are your own estimates.
          </CardDescription>
        </CardHeader>
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
            onCancel={() => {
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
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
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
                placeholder="e.g. Steam Game Library"
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
                  fieldErrors.providerName ? "asset-provider-error" : undefined
                }
              />
              <FieldError
                id="asset-provider-error"
                message={fieldErrors.providerName}
              />
            </div>

            {/* Category select for edit mode; create mode uses the picker */}
            <div className={`${isEdit ? "space-y-2" : "hidden"} space-y-2`}>
              <Label htmlFor="asset-category">
                Category <span aria-hidden="true">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger
                  id="asset-category"
                  aria-invalid={fieldErrors.category ? true : undefined}
                  aria-describedby={
                    fieldErrors.category ? "asset-category-error" : undefined
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

            <div className="grid grid-cols-2 gap-3">
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
            </div>

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
              <p id="asset-description-help" className="text-xs text-muted-foreground">
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
                Optional. Never enter passwords, recovery codes or seed phrases.
              </p>
              <FieldError
                id="asset-account-ref-error"
                message={fieldErrors.accountReference}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-valuation-basis">Valuation basis</Label>
              <Input
                id="asset-valuation-basis"
                value={valuationBasis}
                onChange={(event) => setValuationBasis(event.target.value)}
                placeholder="e.g. Market listing comparison"
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
                Optional. How you arrived at the estimate.
              </p>
              <FieldError
                id="asset-valuation-basis-error"
                message={fieldErrors.valuationBasis}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
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

            {isEdit && (
              <>
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
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            {!isEdit && (
              <button
                type="button"
                onClick={() => setStep("category")}
                className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Change category
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


