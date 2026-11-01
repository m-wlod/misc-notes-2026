import "server-only";

import { lessons } from "#content";
import type { Locale } from "@/i18n/routing";

import { curriculum } from "../../../content/curriculum";

/**
 * The curriculum as the views need it: tracks → modules → lessons, numbered in textbook
 * order (track n, module n.m, lesson n.m.k), in one locale. A lesson without a
 * translation uses its Polish frontmatter (titles stay readable; Phase 6 adds the notice).
 * Plain serialisable data, so client components (path, map) can take it as props.
 */

export type LessonNode = {
  id: string;
  number: string;
  slug: string;
  /** Slugs of the track and module this lesson sits in (this locale), for its URL. */
  trackSlug: string;
  moduleSlug: string;
  title: string;
  summary: string;
  level: number;
  minutes: number;
  prerequisites: string[];
  isStub: boolean;
};

export type ModuleView = {
  id: string;
  number: string;
  slug: string;
  name: string;
  lessons: LessonNode[];
  minutes: number;
};

export type TrackView = {
  id: string;
  number: number;
  slug: string;
  name: string;
  description: string;
  modules: ModuleView[];
  minutes: number;
  levels: { min: number; max: number };
  lessonCount: number;
};

function lessonIn(id: string, locale: Locale) {
  const exact = lessons.find((l) => l.id === id && l.locale === locale);
  const polish = lessons.find((l) => l.id === id && l.locale === "pl");
  const lesson = exact ?? polish;
  // Unreachable for built content: the content build checks every listed id has a file.
  if (!lesson) throw new Error(`curriculum lists "${id}" but no lesson file exists`);
  return lesson;
}

const cache = new Map<Locale, TrackView[]>();

export function getCurriculum(locale: Locale): TrackView[] {
  const cached = cache.get(locale);
  if (cached) return cached;

  const tracks = curriculum.map((track, ti): TrackView => {
    const modules = track.modules.map((mod, mi): ModuleView => {
      const nodes = mod.lessons.map((id, li): LessonNode => {
        const l = lessonIn(id, locale);
        return {
          id,
          number: `${String(ti + 1)}.${String(mi + 1)}.${String(li + 1)}`,
          slug: l.slug,
          trackSlug: track.slug[locale],
          moduleSlug: mod.slug[locale],
          title: l.title,
          summary: l.summary,
          level: l.level,
          minutes: l.estimatedMinutes,
          prerequisites: l.prerequisites,
          isStub: l.isStub,
        };
      });
      return {
        id: mod.id,
        number: `${String(ti + 1)}.${String(mi + 1)}`,
        slug: mod.slug[locale],
        name: mod.name[locale],
        lessons: nodes,
        minutes: nodes.reduce((sum, n) => sum + n.minutes, 0),
      };
    });
    const all = modules.flatMap((m) => m.lessons);
    const levels = all.map((n) => n.level);
    return {
      id: track.id,
      number: ti + 1,
      slug: track.slug[locale],
      name: track.name[locale],
      description: track.description[locale],
      modules,
      minutes: all.reduce((sum, n) => sum + n.minutes, 0),
      levels: { min: Math.min(...levels), max: Math.max(...levels) },
      lessonCount: all.length,
    };
  });
  cache.set(locale, tracks);
  return tracks;
}

export function findTrack(locale: Locale, slug: string): TrackView | undefined {
  return getCurriculum(locale).find((t) => t.slug === slug);
}

export function findModule(
  locale: Locale,
  trackSlug: string,
  moduleSlug: string,
): { track: TrackView; module: ModuleView } | undefined {
  const track = findTrack(locale, trackSlug);
  const mod = track?.modules.find((m) => m.slug === moduleSlug);
  return track && mod ? { track, module: mod } : undefined;
}

/** id → title, for "recommended after" lists that cross tracks. */
export function lessonTitles(locale: Locale): Record<string, string> {
  return Object.fromEntries(
    getCurriculum(locale).flatMap((t) =>
      t.modules.flatMap((m) => m.lessons.map((l) => [l.id, l.title])),
    ),
  );
}

/** The same track or module in the other locale, for the language switcher and hreflang. */
export function trackSlugs(id: string): Record<Locale, string> | undefined {
  const track = curriculum.find((t) => t.id === id);
  return track ? { pl: track.slug.pl, en: track.slug.en } : undefined;
}

export function moduleSlugs(
  trackId: string,
  moduleId: string,
): Record<Locale, { track: string; module: string }> | undefined {
  const track = curriculum.find((t) => t.id === trackId);
  const mod = track?.modules.find((m) => m.id === moduleId);
  if (!track || !mod) return undefined;
  return {
    pl: { track: track.slug.pl, module: mod.slug.pl },
    en: { track: track.slug.en, module: mod.slug.en },
  };
}

/** Titles for the prerequisites of `nodes` only, so each path ships just what it shows. */
export function titlesFor(locale: Locale, nodes: readonly LessonNode[]): Record<string, string> {
  const all = lessonTitles(locale);
  const ids = new Set(nodes.flatMap((n) => n.prerequisites));
  return Object.fromEntries([...ids].map((id) => [id, all[id] ?? id]));
}

export function formatDuration(totalMinutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** Every lesson in textbook order, with its track and module. */
export function lessonsInOrder(locale: Locale) {
  return getCurriculum(locale).flatMap((track) =>
    track.modules.flatMap((mod) => mod.lessons.map((lesson) => ({ track, module: mod, lesson }))),
  );
}

export type LessonPlace = ReturnType<typeof lessonsInOrder>[number];

/** The lesson at /learn/<track>/<module>/<lesson> in this locale. */
export function findLesson(
  locale: Locale,
  trackSlug: string,
  moduleSlug: string,
  lessonSlug: string,
): LessonPlace | undefined {
  return lessonsInOrder(locale).find(
    (p) =>
      p.track.slug === trackSlug && p.module.slug === moduleSlug && p.lesson.slug === lessonSlug,
  );
}

/**
 * Previous and next lessons in textbook order. A lesson outside the curriculum (the
 * Phase 4 sample) gets the first lesson as "next", so its reader flow still continues.
 */
export function neighbours(
  locale: Locale,
  id: string,
): { prev: LessonNode | null; next: LessonNode | null } {
  const all = lessonsInOrder(locale).map((p) => p.lesson);
  const i = all.findIndex((l) => l.id === id);
  if (i === -1) return { prev: null, next: all[0] ?? null };
  return { prev: all[i - 1] ?? null, next: all[i + 1] ?? null };
}

export { lessonHref } from "./href";

/** id → lesson node in this locale (for prerequisite links that cross tracks). */
export function lessonNodes(locale: Locale): Record<string, LessonNode> {
  return Object.fromEntries(lessonsInOrder(locale).map((p) => [p.lesson.id, p.lesson]));
}
