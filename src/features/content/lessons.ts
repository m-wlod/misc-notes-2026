import "server-only";

import { glossary, lessons, type GlossaryTerm, type Lesson } from "#content";
import type { Locale } from "@/i18n/routing";

export type { GlossaryTerm, Lesson };

export type ResolvedLesson = {
  lesson: Lesson;
  /** True when shown in Polish as a fallback. */ fallback: boolean;
};

/**
 * A lesson in the requested locale. A missing translation falls back to the Polish
 * file with `fallback: true`, so the page can show the notice (CLAUDE.md content model).
 * `includeDrafts` is for the internal preview only.
 */
export function getLesson(
  id: string,
  locale: Locale,
  { includeDrafts = false }: { includeDrafts?: boolean } = {},
): ResolvedLesson | null {
  const visible = (l: Lesson) => includeDrafts || l.status === "published";
  const exact = lessons.find((l) => l.id === id && l.locale === locale && visible(l));
  if (exact) return { lesson: exact, fallback: false };
  const polish = lessons.find((l) => l.id === id && l.locale === "pl" && visible(l));
  return polish ? { lesson: polish, fallback: locale !== "pl" } : null;
}

/** Every lesson id once (Polish is canonical), with the locales it exists in. */
export function listLessons({ includeDrafts = false }: { includeDrafts?: boolean } = {}) {
  return lessons
    .filter((l) => l.locale === "pl" && (includeDrafts || l.status === "published"))
    .map((l) => ({
      lesson: l,
      locales: lessons.filter((t) => t.id === l.id).map((t) => t.locale),
    }))
    .sort((a, b) => a.lesson.id.localeCompare(b.lesson.id));
}

export function getGlossary(): readonly GlossaryTerm[] {
  return glossary;
}
