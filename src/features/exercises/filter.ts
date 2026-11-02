import type { Exercise, ExerciseType } from "./schema";

/**
 * Practice filters, carried in the URL (`?track=…&level=2&lesson=…`) so a set is
 * shareable and the exercise page can find "the next one in this set". Pure.
 */
export type Filters = {
  track?: string;
  topic?: string;
  level?: number;
  type?: ExerciseType;
  lesson?: string;
};

const TYPES: readonly ExerciseType[] = [
  "numeric",
  "estimation",
  "interactive",
  "symbolic",
  "choice",
  "multi",
  "ordering",
  "code",
  "open",
  "brainteaser",
];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Unknown or malformed values are dropped, never trusted. */
export function parseFilters(search: Search): Filters {
  const f: Filters = {};
  const track = one(search.track);
  const topic = one(search.topic);
  const lesson = one(search.lesson);
  const type = one(search.type);
  const level = Number(one(search.level));
  if (track && ID.test(track)) f.track = track;
  if (topic && topic.length <= 60 && /^[\p{L}\p{N} -]+$/u.test(topic)) f.topic = topic;
  if (lesson && ID.test(lesson)) f.lesson = lesson;
  if (type && (TYPES as readonly string[]).includes(type)) f.type = type as ExerciseType;
  if (Number.isInteger(level) && level >= 1 && level <= 5) f.level = level;
  return f;
}

export function applyFilters(
  list: readonly Exercise[],
  f: Filters,
  trackOf: (lessonId: string) => string | undefined,
): Exercise[] {
  return list.filter(
    (ex) =>
      (f.level === undefined || ex.level === f.level) &&
      (f.type === undefined || ex.type === f.type) &&
      (f.topic === undefined || ex.topics.includes(f.topic)) &&
      (f.lesson === undefined || ex.lessonIds.includes(f.lesson)) &&
      (f.track === undefined || ex.lessonIds.some((l) => trackOf(l) === f.track)),
  );
}

/** Query string for the filters (stable order), with a leading "?" or "" when empty. */
export function toQuery(f: Filters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const key of ["track", "topic", "level", "type", "lesson"] as const) {
    const v = f[key];
    if (v !== undefined) params.set(key, String(v));
  }
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** The exercise after `id` in the filtered set (wrapping), or null if alone. */
export function nextInSet(set: readonly Exercise[], id: string): Exercise | null {
  if (set.length < 2) return null;
  const i = set.findIndex((e) => e.id === id);
  return set[(i + 1) % set.length] ?? null;
}
