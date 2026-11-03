/**
 * Glossary list logic, shared by the server page and the client-side search.
 * Pure functions, so the Polish-specific rules are unit-tested.
 */

import { fold } from "@/lib/text/fold";

export type GlossaryEntry = {
  id: string;
  /** Name in the page locale, and in the other locale (both are searchable). */
  name: string;
  otherName: string;
  definition: string;
  sample: boolean;
  /** The lesson that teaches the term (Phase 19b internal linking). */
  lesson?: { href: string; title: string } | undefined;
};

export { fold } from "@/lib/text/fold";

export function sortEntries(entries: readonly GlossaryEntry[], locale: string): GlossaryEntry[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return [...entries].sort((a, b) => collator.compare(a.name, b.name));
}

/** Initial letter for A–Z grouping, kept with its diacritic: "Ł" is its own Polish letter. */
export function initialOf(name: string, locale: string): string {
  return (name.trim()[0] ?? "#").toLocaleUpperCase(locale);
}

export function groupByInitial(
  sorted: readonly GlossaryEntry[],
  locale: string,
): { letter: string; entries: GlossaryEntry[] }[] {
  const groups: { letter: string; entries: GlossaryEntry[] }[] = [];
  for (const entry of sorted) {
    const letter = initialOf(entry.name, locale);
    const last = groups.at(-1);
    if (last?.letter === letter) last.entries.push(entry);
    else groups.push({ letter, entries: [entry] });
  }
  return groups;
}

/** Matches either language's name or the definition, ignoring case and diacritics. */
export function matches(entry: GlossaryEntry, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [entry.name, entry.otherName, entry.definition].some((field) => fold(field).includes(q));
}
