import { categoryLabel } from "@/lib/asset-schemas";
import { formatMoney } from "@/lib/currency";
import type { CurrencyTotal } from "@/lib/portfolio";

type CategoryGroup = {
  category: string;
  count: number;
  totals: CurrencyTotal[];
};

const SWATCHES = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#4f46e5",
  "#64748b",
];

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/**
 * Category distribution, rendered separately for each currency so the chart
 * never implies a cross-currency total. Values are the user's saved
 * valuations, not live prices.
 */
export function PortfolioDistribution({
  categories,
  totalsByCurrency,
}: {
  categories: CategoryGroup[];
  totalsByCurrency: CurrencyTotal[];
}) {
  const currencies = totalsByCurrency.filter((entry) => entry.total > 0);
  if (categories.length === 0 || currencies.length === 0) return null;

  const colorByCategory = new Map<string, string>();
  categories.forEach((entry, index) => {
    colorByCategory.set(entry.category, SWATCHES[index % SWATCHES.length]);
  });

  return (
    <div className="space-y-5">
      {currencies.map((currencyTotal) => {
        const segments = categories
          .map((group) => ({
            category: group.category,
            value: group.totals.find((t) => t.currency === currencyTotal.currency)?.total ?? 0,
            count: group.count,
          }))
          .filter((segment) => segment.value > 0)
          .sort((a, b) => b.value - a.value);

        if (segments.length === 0) return null;

        return (
          <div key={currencyTotal.currency}>
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {currencyTotal.currency} distribution
              </p>
              <p className="text-xs text-muted-foreground">
                Saved total {formatMoney(currencyTotal.total, currencyTotal.currency)}
              </p>
            </div>

            <div
              className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${currencyTotal.currency} category distribution`}
            >
              {segments.map((segment) => (
                <div
                  key={segment.category}
                  style={{
                    width: `${percent(segment.value, currencyTotal.total)}%`,
                    backgroundColor: colorByCategory.get(segment.category),
                  }}
                  title={`${categoryLabel(segment.category)}: ${formatMoney(
                    segment.value,
                    currencyTotal.currency,
                  )}`}
                />
              ))}
            </div>

            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {segments.map((segment) => (
                <li
                  key={segment.category}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorByCategory.get(segment.category) }}
                    aria-hidden
                  />
                  <span className="text-foreground">{categoryLabel(segment.category)}</span>
                  <span>
                    {percent(segment.value, currencyTotal.total)}%
                    {segment.count > 1 ? ` · ${segment.count} assets` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
