import "server-only";

import { debunk, type DebunkEntry } from "#content";
import type { Locale } from "@/i18n/routing";

/**
 * Debunk Lab entries (Phase 16). Published ones for everyone; drafts and labelled
 * samples only on internal deployments. A missing translation falls back to Polish.
 */
export type { DebunkEntry };
export const CATEGORIES = [
  "indicators",
  "money-management",
  "course-economics",
  "signals",
  "secret-strategy",
  "fibonacci-elliott",
  "martingale-grid",
  "backtests",
] as const satisfies readonly DebunkEntry["category"][];
export const VERDICTS = [
  "false",
  "misleading",
  "true-but-irrelevant",
  "depends",
] as const satisfies readonly DebunkEntry["verdict"][];

const visible = (e: DebunkEntry, internal: boolean) => e.status === "published" || internal;

export function listEntries(
  locale: Locale,
  internal: boolean,
): (DebunkEntry & { fallback: boolean })[] {
  const ids = [
    ...new Set(debunk.filter((e) => e.locale === "pl" && visible(e, internal)).map((e) => e.id)),
  ];
  return ids
    .map((id) => {
      const exact = debunk.find((e) => e.id === id && e.locale === locale && visible(e, internal));
      const pl = debunk.find((e) => e.id === id && e.locale === "pl");
      const chosen = exact ?? pl;
      return chosen ? { ...chosen, fallback: !exact } : null;
    })
    .filter((e): e is DebunkEntry & { fallback: boolean } => e !== null)
    .sort((a, b) => a.claim.localeCompare(b.claim, locale));
}

export function entryBySlug(slug: string, locale: Locale, internal: boolean) {
  return listEntries(locale, internal).find((e) => e.slug === slug) ?? null;
}

/** The slug of an entry in each locale (for alternates and the language switch). */
export function slugsOf(id: string): Partial<Record<Locale, string>> {
  return Object.fromEntries(debunk.filter((e) => e.id === id).map((e) => [e.locale, e.slug]));
}

export function allSlugs(): { locale: Locale; slug: string }[] {
  return debunk.map((e) => ({ locale: e.locale, slug: e.slug }));
}
