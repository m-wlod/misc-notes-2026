import type { Formats } from "next-intl";

/**
 * Locale-aware formatting for places outside React (metadata, emails, scripts).
 * Components should prefer next-intl's `useFormatter()` / `getFormatter()`, which use
 * the same named `formats` below.
 *
 * Note: Intl's pl-PL leaves 4-digit numbers ungrouped (1240, but 12 400). That is
 * the Polish typographic norm, not a bug.
 */

export type AppLocale = "pl" | "en";
const tag: Record<AppLocale, string> = { pl: "pl-PL", en: "en-GB" };

export function formatNumber(locale: AppLocale, value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(tag[locale], { maximumFractionDigits }).format(value);
}

/** `ratio` is a fraction: 0.25 → "25%". */
export function formatPercent(locale: AppLocale, ratio: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(tag[locale], { style: "percent", maximumFractionDigits }).format(
    ratio,
  );
}

export function formatCurrency(locale: AppLocale, amount: number, currency: "PLN" | "USD"): string {
  return new Intl.NumberFormat(tag[locale], { style: "currency", currency }).format(amount);
}

export function formatDate(locale: AppLocale, date: Date, timeZone = "Europe/Warsaw"): string {
  return new Intl.DateTimeFormat(tag[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** Named formats for next-intl (`format.number(x, "percent")`). */
export const formats = {
  number: {
    precise: { maximumFractionDigits: 6 },
    percent: { style: "percent", maximumFractionDigits: 1 },
    pln: { style: "currency", currency: "PLN" },
    usd: { style: "currency", currency: "USD" },
  },
  dateTime: {
    short: { day: "numeric", month: "short", year: "numeric" },
  },
} satisfies Formats;
