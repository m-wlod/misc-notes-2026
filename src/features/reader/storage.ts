import { z } from "zod";

import {
  emptyLocalProgress,
  LOCAL_PROGRESS_KEY,
  localProgressSchema,
  mergeStatus,
  type LessonStatus,
} from "@/features/progress/schema";

/**
 * Reader state kept in this browser until accounts exist. Pure functions take and return
 * the raw stored string, so they are unit-tested without a DOM.
 */

function parseProgress(raw: string | null) {
  if (!raw) return emptyLocalProgress();
  try {
    const parsed = localProgressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyLocalProgress();
  } catch {
    return emptyLocalProgress();
  }
}

/** Moves a lesson's status forward only (never from "completed" back to "in_progress"). */
export function withLessonStatus(
  raw: string | null,
  lessonId: string,
  status: LessonStatus,
  now: Date,
): string {
  const progress = parseProgress(raw);
  const current = progress.lessons[lessonId]?.status;
  const next = mergeStatus(current, status);
  if (next === current) return JSON.stringify(progress);
  progress.lessons[lessonId] = { status: next, updatedAt: now.toISOString() };
  return JSON.stringify(progress);
}

export const READING_KEY = "qla:reading:v1";

export const readingSchema = z.object({
  version: z.literal(1),
  lessons: z.record(
    z.string().max(120),
    z.object({ section: z.string().max(200), updatedAt: z.iso.datetime() }),
  ),
});
export type ReadingState = z.infer<typeof readingSchema>;

export function parseReading(raw: string | null): ReadingState {
  if (!raw) return { version: 1, lessons: {} };
  try {
    const parsed = readingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { version: 1, lessons: {} };
  } catch {
    return { version: 1, lessons: {} };
  }
}

/** Remembers the furthest section reached (by its position in the lesson). */
export function withSection(
  raw: string | null,
  lessonId: string,
  section: string,
  order: readonly string[],
  now: Date,
): string {
  const state = parseReading(raw);
  const previous = state.lessons[lessonId]?.section;
  if (previous && order.indexOf(previous) >= order.indexOf(section)) return JSON.stringify(state);
  state.lessons[lessonId] = { section, updatedAt: now.toISOString() };
  return JSON.stringify(state);
}

/** Minutes left, from the lesson's estimate and how far the reader has scrolled (0–1). */
export function minutesLeft(estimatedMinutes: number, fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return Math.ceil(estimatedMinutes * (1 - f));
}

/** Browser side: write and notify same-tab listeners (`storage` only fires in other tabs). */
export function store(key: string, update: (raw: string | null) => string): void {
  try {
    const before = localStorage.getItem(key);
    const after = update(before);
    if (after === before) return;
    localStorage.setItem(key, after);
    window.dispatchEvent(new StorageEvent("storage", { key }));
  } catch {
    // Private mode or full storage: the page still works, it just doesn't remember.
  }
}

export function setLessonStatus(lessonId: string, status: LessonStatus): void {
  store(LOCAL_PROGRESS_KEY, (raw) => withLessonStatus(raw, lessonId, status, new Date()));
}
