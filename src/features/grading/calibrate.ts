/**
 * Difficulty calibration (Phase 9): from recorded attempts to `exercise_stats`, and a
 * flag when an exercise behaves harder or easier than its level. Pure; the nightly job
 * (route /api/cron/calibrate, scheduled in Phase 14) feeds it attempts from the database.
 */
export type AttemptRow = { exerciseId: string; score: number; timeMs: number | null };
export type ExerciseStat = {
  exerciseId: string;
  attempts: number;
  successRate: number;
  medianTimeMs: number | null;
};

/** Expected success rate per level: [min, max]. Outside it, the level may be wrong. */
export const EXPECTED: Record<number, [number, number]> = {
  1: [0.7, 1],
  2: [0.55, 0.95],
  3: [0.4, 0.85],
  4: [0.25, 0.7],
  5: [0, 0.4],
};
/** Too few attempts say nothing about difficulty. */
export const MIN_ATTEMPTS = 30;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1
    ? (s[mid] ?? null)
    : Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
}

export function calibrate(rows: readonly AttemptRow[]): ExerciseStat[] {
  const byExercise = new Map<string, AttemptRow[]>();
  for (const r of rows) byExercise.set(r.exerciseId, [...(byExercise.get(r.exerciseId) ?? []), r]);
  return [...byExercise.entries()]
    .map(([exerciseId, list]) => ({
      exerciseId,
      attempts: list.length,
      // A solved attempt is a full score; partial credit counts as not solved here.
      successRate:
        Math.round((list.filter((r) => r.score >= 1).length / list.length) * 10000) / 10000,
      medianTimeMs: median(list.flatMap((r) => (r.timeMs === null ? [] : [r.timeMs]))),
    }))
    .sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
}

export type Flag = {
  exerciseId: string;
  level: number;
  successRate: number;
  verdict: "too-easy" | "too-hard";
};

/** Exercises whose observed success rate doesn't fit their level (with enough attempts). */
export function flags(
  stats: readonly ExerciseStat[],
  levelOf: (id: string) => number | undefined,
): Flag[] {
  return stats.flatMap((s): Flag[] => {
    const level = levelOf(s.exerciseId);
    const band = level === undefined ? undefined : EXPECTED[level];
    if (!band || level === undefined || s.attempts < MIN_ATTEMPTS) return [];
    if (s.successRate > band[1])
      return [
        {
          exerciseId: s.exerciseId,
          level,
          successRate: s.successRate,
          verdict: "too-easy" as const,
        },
      ];
    if (s.successRate < band[0])
      return [
        {
          exerciseId: s.exerciseId,
          level,
          successRate: s.successRate,
          verdict: "too-hard" as const,
        },
      ];
    return [];
  });
}
