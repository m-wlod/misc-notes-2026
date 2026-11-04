/**
 * Learning analytics for staff (Phase 22c): pure helpers over the rows the database
 * functions return, so the page only renders. Levels and titles come from the content.
 */
export type LessonRow = { lesson_id: string; started: number; completed: number; stalled: number };
export type HintRow = {
  exercise_id: string;
  attempts: number;
  hints: number;
  solves: number;
  solves_with_hints: number;
};

/** Below this many starts a completion rate says little, so those lessons go last. */
export const MIN_STARTS = 5;

export type Dropoff = LessonRow & { rate: number | null };

/** Lessons where learners stop, worst completion rate first (enough starts first). */
export function lessonDropoff(rows: readonly LessonRow[]): Dropoff[] {
  return rows
    .map((r) => ({ ...r, rate: r.started > 0 ? r.completed / r.started : null }))
    .sort((a, b) => {
      const enoughA = a.started >= MIN_STARTS;
      const enoughB = b.started >= MIN_STARTS;
      if (enoughA !== enoughB) return enoughA ? -1 : 1;
      return (
        (a.rate ?? 1) - (b.rate ?? 1) ||
        b.started - a.started ||
        a.lesson_id.localeCompare(b.lesson_id)
      );
    });
}

export type LevelHints = {
  level: number;
  attempts: number;
  hintsPerAttempt: number;
  solves: number;
  /** Share of solves that used at least one hint. */
  hintedShare: number | null;
};

/** Hint dependence by level (1–5); exercises with an unknown level are left out. */
export function hintsByLevel(
  rows: readonly HintRow[],
  levelOf: (exerciseId: string) => number | undefined,
): LevelHints[] {
  const by = new Map<number, { attempts: number; hints: number; solves: number; hinted: number }>();
  for (const r of rows) {
    const level = levelOf(r.exercise_id);
    if (level === undefined) continue;
    const t = by.get(level) ?? { attempts: 0, hints: 0, solves: 0, hinted: 0 };
    by.set(level, {
      attempts: t.attempts + r.attempts,
      hints: t.hints + r.hints,
      solves: t.solves + r.solves,
      hinted: t.hinted + r.solves_with_hints,
    });
  }
  return [1, 2, 3, 4, 5].map((level) => {
    const t = by.get(level) ?? { attempts: 0, hints: 0, solves: 0, hinted: 0 };
    return {
      level,
      attempts: t.attempts,
      hintsPerAttempt: t.attempts > 0 ? t.hints / t.attempts : 0,
      solves: t.solves,
      hintedShare: t.solves > 0 ? t.hinted / t.solves : null,
    };
  });
}
