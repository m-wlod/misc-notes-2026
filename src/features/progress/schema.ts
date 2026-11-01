import { z } from "zod";

/**
 * Progress kept in the browser for signed-out learners (localStorage key below), merged
 * into the account on sign-in. Everything here is untrusted: the server re-validates it,
 * imported attempts are marked `anonymous_import` and never earn XP.
 */
export const LOCAL_PROGRESS_KEY = "qla:progress:v1";

export const LESSON_STATUSES = ["not_started", "in_progress", "completed", "mastered"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

const id = z.string().regex(/^[a-z0-9][a-z0-9._/-]{0,119}$/);

export const localProgressSchema = z.object({
  version: z.literal(1),
  lessons: z
    .record(id, z.object({ status: z.enum(LESSON_STATUSES), updatedAt: z.iso.datetime() }))
    .refine((r) => Object.keys(r).length <= 500, "too many lessons"),
  attempts: z
    .array(
      z.object({
        clientId: z.uuid(),
        exerciseId: id,
        score: z.number().min(0).max(1),
        answer: z.json().refine((v) => v !== null, "answer is required"),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(1000),
});

export type LocalProgress = z.infer<typeof localProgressSchema>;

export const emptyLocalProgress = (): LocalProgress => ({ version: 1, lessons: {}, attempts: [] });

/** Statuses only move forward: merging never downgrades what the account already has. */
export function mergeStatus(
  current: LessonStatus | undefined,
  incoming: LessonStatus,
): LessonStatus {
  if (!current) return incoming;
  return LESSON_STATUSES.indexOf(incoming) > LESSON_STATUSES.indexOf(current) ? incoming : current;
}

/** Lesson rows to upsert: only those where the local status is ahead of the account's. */
export function lessonUpserts(
  local: LocalProgress["lessons"],
  existing: ReadonlyMap<string, LessonStatus>,
): { lesson_id: string; status: LessonStatus }[] {
  return Object.entries(local)
    .filter(
      ([lessonId, { status }]) =>
        mergeStatus(existing.get(lessonId), status) !== existing.get(lessonId),
    )
    .map(([lessonId, { status }]) => ({ lesson_id: lessonId, status }));
}
