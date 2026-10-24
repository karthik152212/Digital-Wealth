const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export function formatMoney(amount: number, currency: string): string {
  const code = (currency || "INR").toUpperCase();
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    const locale = LOCALE_BY_CURRENCY[code] ?? "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(2)} ${code}`;
  }
}

export function toAmount(value: unknown): number {
  if (value == null) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}
