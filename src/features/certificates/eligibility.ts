/**
 * Certificates per track (Phase 15): every lesson of the track completed and a mastery
 * score of at least `MIN_MASTERY`: the average of the best score on each of the track's
 * exercises (an exercise never tried counts as 0). A track without exercises needs the
 * lessons only. It certifies completing a course, never a professional qualification.
 */
export const MIN_MASTERY = 0.8;

export function mastery(
  exerciseIds: readonly string[],
  bestScore: ReadonlyMap<string, number>,
): number | null {
  if (exerciseIds.length === 0) return null;
  const sum = exerciseIds.reduce(
    (s, id) => s + Math.min(1, Math.max(0, bestScore.get(id) ?? 0)),
    0,
  );
  return sum / exerciseIds.length;
}

export type Progress = {
  lessonsTotal: number;
  lessonsDone: number;
  /** null: the track has no exercises. */
  mastery: number | null;
};

export function trackProgress(
  lessonIds: readonly string[],
  completed: ReadonlySet<string>,
  exerciseIds: readonly string[],
  bestScore: ReadonlyMap<string, number>,
): Progress {
  return {
    lessonsTotal: lessonIds.length,
    lessonsDone: lessonIds.filter((id) => completed.has(id)).length,
    mastery: mastery(exerciseIds, bestScore),
  };
}

export const eligible = (p: Progress) =>
  p.lessonsTotal > 0 &&
  p.lessonsDone === p.lessonsTotal &&
  (p.mastery === null || p.mastery >= MIN_MASTERY - 1e-9);

/** The best score per exercise from attempt rows. */
export function bestScores(rows: readonly { exercise_id: string; score: number }[]) {
  const best = new Map<string, number>();
  for (const r of rows) best.set(r.exercise_id, Math.max(best.get(r.exercise_id) ?? 0, r.score));
  return best;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isCertificateId = (id: string) => UUID.test(id);

/**
 * Attempts that count toward a certificate: those made before the learner first revealed
 * that exercise's solution (Phase 21c). Typing in the shown answer is not a solve.
 * Rows must be in time order.
 */
export function solvedBeforeReveal<
  R extends { exercise_id: string; score: number; answer: unknown },
>(rows: readonly R[]): R[] {
  const revealed = new Set<string>();
  const out: R[] = [];
  for (const r of rows) {
    const a = r.answer as { revealed?: unknown } | null;
    if (a !== null && typeof a === "object" && a.revealed === true) revealed.add(r.exercise_id);
    else if (!revealed.has(r.exercise_id)) out.push(r);
  }
  return out;
}
