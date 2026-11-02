import { ELO } from "./config";

/**
 * Skill rating per topic (Phase 14): Elo against the exercise's difficulty, which comes
 * from its level. The rating drives "recommended next exercise".
 */
export const difficulty = (level: number) => ELO.difficultyBase + ELO.difficultyPerLevel * level;

/** Chance of solving an exercise of difficulty `d` at rating `r`. */
export const expectedScore = (r: number, d: number) => 1 / (1 + 10 ** ((d - r) / 400));

/** The new rating after an attempt scored 0–1. */
export function updateRating(r: number, level: number, score: number, k: number = ELO.k): number {
  const s = Math.min(1, Math.max(0, score));
  return r + k * (s - expectedScore(r, difficulty(level)));
}

export type Candidate = { id: string; level: number; topics: readonly string[] };

/**
 * The next exercise: unsolved, in the learner's weakest rated topic when one fits (else
 * any topic), with the difficulty closest to their rating plus a little stretch. Ties go
 * to the lower level, then the id, so the choice is stable.
 */
export function recommend(
  ratings: ReadonlyMap<string, number>,
  exercises: readonly Candidate[],
  solved: ReadonlySet<string>,
): Candidate | null {
  const open = exercises.filter((e) => !solved.has(e.id));
  if (open.length === 0) return null;
  const ratingOf = (e: Candidate) => Math.min(...e.topics.map((t) => ratings.get(t) ?? ELO.start));
  const weakest = [...ratings.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const pool =
    weakest
      .map(([topic]) => open.filter((e) => e.topics.includes(topic)))
      .find((p) => p.length > 0) ?? open;
  const distance = (e: Candidate) => Math.abs(difficulty(e.level) - (ratingOf(e) + ELO.stretch));
  return (
    [...pool].sort(
      (a, b) => distance(a) - distance(b) || a.level - b.level || (a.id < b.id ? -1 : 1),
    )[0] ?? null
  );
}
