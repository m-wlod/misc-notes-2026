"use server";

import { createAdminClient } from "@/lib/db/admin";
import type { Json } from "@/lib/db/database.types";
import { getSession } from "@/lib/db/session";

import { lessonUpserts, localProgressSchema, type LessonStatus } from "./schema";

export type MergeResult = { ok: true; lessons: number; attempts: number } | { ok: false };

/**
 * Merges progress a learner made while signed out into their account.
 * - Lessons: written as the user (RLS), only where the local status is ahead.
 * - Attempts: written with the secret key because attempts are server-owned. They are
 *   marked `anonymous_import` (never earn XP: the scores came from the browser) and
 *   deduplicated by client id, so a retried merge imports nothing twice.
 */
export async function mergeAnonymousProgress(input: unknown): Promise<MergeResult> {
  const parsed = localProgressSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  const { supabase, user } = session;
  const { lessons, attempts } = parsed.data;

  const lessonIds = Object.keys(lessons);
  let lessonCount = 0;
  if (lessonIds.length > 0) {
    const { data: existing, error } = await supabase
      .from("lesson_progress")
      .select("lesson_id, status")
      .in("lesson_id", lessonIds);
    if (error) return { ok: false };
    const current = new Map<string, LessonStatus>(existing.map((r) => [r.lesson_id, r.status]));
    const rows = lessonUpserts(lessons, current).map((r) => ({
      ...r,
      user_id: user.id,
      completed_at:
        r.status === "completed" || r.status === "mastered" ? new Date().toISOString() : null,
    }));
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("lesson_progress")
        .upsert(rows, { onConflict: "user_id,lesson_id" });
      if (upsertError) return { ok: false };
    }
    lessonCount = rows.length;
  }

  if (attempts.length > 0) {
    const admin = createAdminClient();
    if (!admin) return { ok: false };
    const { error } = await admin.from("exercise_attempts").upsert(
      attempts.map((a) => ({
        user_id: user.id,
        exercise_id: a.exerciseId,
        // Non-null: the schema refines `answer !== null` (zod/mini keeps null in the type).
        answer: a.answer as NonNullable<Json>,
        score: a.score,
        grader: "auto" as const,
        source: "anonymous_import" as const,
        client_attempt_id: a.clientId,
        created_at: a.createdAt,
      })),
      { onConflict: "user_id,client_attempt_id", ignoreDuplicates: true },
    );
    if (error) return { ok: false };
  }

  return { ok: true, lessons: lessonCount, attempts: attempts.length };
}
