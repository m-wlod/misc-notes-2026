import "server-only";

import { lessonNodes } from "@/features/curriculum";
import type { Locale } from "@/i18n/routing";

import { listExercises } from "./data";
import { applyFilters, type Filters } from "./filter";
import { curriculum } from "../../../content/curriculum";

/** Track id of a curriculum lesson (undefined for the sample lesson). */
export function trackOf(lessonId: string): string | undefined {
  return curriculum.find((t) => t.modules.some((m) => m.lessons.includes(lessonId)))?.id;
}

/** The exercises in a practice set, in a stable order: level, then id. */
export function practiceSet(filters: Filters, internal: boolean) {
  return applyFilters(listExercises(internal), filters, trackOf).sort(
    (a, b) => a.level - b.level || a.id.localeCompare(b.id),
  );
}

/** How many exercises practise a lesson (for "Ćwicz tę lekcję"). */
export function exerciseCount(lessonId: string, internal: boolean): number {
  return listExercises(internal).filter((e) => e.lessonIds.includes(lessonId)).length;
}

/** Lesson title for the "exercises for the lesson" chip, if it is a curriculum lesson. */
export function lessonTitle(locale: Locale, lessonId: string): string | undefined {
  return lessonNodes(locale)[lessonId]?.title;
}
