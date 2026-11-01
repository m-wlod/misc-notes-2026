import type { Curriculum } from "../curriculum/schema";

/**
 * What the search index holds, per locale: one document per lesson in the curriculum and
 * per glossary term. Built at content-build time (velite.config.ts `complete`) into
 * public/search/<locale>.json and loaded by the search dialog when it opens.
 * Lesson results link to the lesson's row on its module page until the reader exists
 * (Phase 6). Exercises join in Phase 8.
 */
export type SearchDoc = {
  id: string;
  type: "lesson" | "term";
  title: string;
  /** Track and module for lessons; the other language's name for terms. */
  context: string;
  text: string;
  url: string;
};

type Locale = "pl" | "en";
type LessonInput = {
  id: string;
  locale: string;
  title: string;
  summary: string;
  text: string;
  isStub: boolean;
};
type TermInput = {
  id: string;
  name: Record<Locale, string>;
  definition: Record<Locale, string>;
};
/** Public path prefixes per locale, from src/i18n/routing.ts. */
export type Paths = { learn: Record<Locale, string>; glossary: Record<Locale, string> };

export function buildSearchDocs(
  locale: Locale,
  curriculum: Curriculum,
  lessons: readonly LessonInput[],
  glossary: readonly TermInput[],
  paths: Paths,
): SearchDoc[] {
  const other: Locale = locale === "pl" ? "en" : "pl";
  const docs: SearchDoc[] = [];
  for (const track of curriculum) {
    for (const mod of track.modules) {
      for (const id of mod.lessons) {
        const lesson =
          lessons.find((l) => l.id === id && l.locale === locale) ??
          lessons.find((l) => l.id === id && l.locale === "pl");
        if (!lesson) continue;
        docs.push({
          id: `lesson:${id}`,
          type: "lesson",
          title: lesson.title,
          context: `${track.name[locale]} · ${mod.name[locale]}`,
          text: `${lesson.summary} ${lesson.text}`.trim(),
          url: `/${locale}${paths.learn[locale]}/${track.slug[locale]}/${mod.slug[locale]}#${id}`,
        });
      }
    }
  }
  for (const term of glossary) {
    docs.push({
      id: `term:${term.id}`,
      type: "term",
      title: term.name[locale],
      context: term.name[other],
      text: term.definition[locale],
      url: `/${locale}${paths.glossary[locale]}#${term.id}`,
    });
  }
  return docs;
}
