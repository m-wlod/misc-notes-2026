import "server-only";

import { allExercises } from "@/features/exercises/data";
import { isVisible } from "@/features/exercises/visibility";
import { createAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/db/session";

import {
  bestScores,
  isCertificateId,
  solvedBeforeReveal,
  trackProgress,
  type Progress,
} from "./eligibility";
import { curriculum } from "../../../content/curriculum";

/**
 * Certificates on the account (Phase 15). Issued by the server (certificates are
 * server-written); verified publicly through `verify_certificate()`.
 */
export const TRACK_IDS = curriculum.map((t) => t.id);

export function trackLessons(trackId: string): string[] {
  return curriculum.find((t) => t.id === trackId)?.modules.flatMap((m) => m.lessons) ?? [];
}

/** Published exercises that practise a lesson of the track. */
export function trackExercises(trackId: string): string[] {
  const lessons = new Set(trackLessons(trackId));
  return allExercises()
    .filter((e) => isVisible(e, false) && e.lessonIds.some((l) => lessons.has(l)))
    .map((e) => e.id);
}

/** The signed-in learner's progress on every track (own rows, RLS). */
export async function readTrackProgress(session: Session): Promise<Map<string, Progress>> {
  const [lessons, attempts] = await Promise.all([
    session.supabase.from("lesson_progress").select("lesson_id, status"),
    // Server-graded attempts only: imported anonymous progress carries scores from the
    // browser, so it never counts toward a certificate (Phase 21). Lesson completion is
    // self-reported by design ("Oznacz jako zrozumiane"); the exercises are the proof.
    session.supabase
      .from("exercise_attempts")
      .select("exercise_id, score, answer, created_at")
      .eq("source", "app")
      .order("created_at")
      .limit(10_000),
  ]);
  const completed = new Set(
    (lessons.data ?? [])
      .filter((r) => r.status === "completed" || r.status === "mastered")
      .map((r) => r.lesson_id),
  );
  const best = bestScores(solvedBeforeReveal(attempts.data ?? []));
  return new Map(
    TRACK_IDS.map((id) => [
      id,
      trackProgress(trackLessons(id), completed, trackExercises(id), best),
    ]),
  );
}

export async function readCertificates(session: Session) {
  const { data } = await session.supabase
    .from("certificates")
    .select("id, track_id, issued_at")
    .order("issued_at");
  return data ?? [];
}

export type Verified = { trackId: string; issuedAt: string; name: string };

/** Public check by id; null when the id is malformed or unknown. */
export async function verifyCertificate(id: string): Promise<Verified | null> {
  if (!isCertificateId(id)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.rpc("verify_certificate", { certificate_id: id });
  const row = data?.[0];
  return row
    ? { trackId: row.track_id, issuedAt: row.issued_at, name: row.display_name || row.handle }
    : null;
}
