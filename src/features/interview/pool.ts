import type { PublicExercise } from "@/features/exercises/view";
import { mulberry32 } from "@/lib/math/rng";

/**
 * Picks the questions for an exercise-based interview session (Phase 11): the closest
 * levels first (the chosen level, then ±1, ±2…), shuffled within a level by the seed,
 * up to the session size. With a small pool the session is simply shorter.
 */
export function pickQuestions<T extends Pick<PublicExercise, "id" | "level">>(
  pool: readonly T[],
  level: number,
  size: number,
  seed: number,
): T[] {
  const rand = mulberry32(seed);
  const keyed = pool.map((q) => ({ q, distance: Math.abs(q.level - level), tie: rand() }));
  keyed.sort((a, b) => a.distance - b.distance || a.tie - b.tie || a.q.id.localeCompare(b.q.id));
  return keyed.slice(0, size).map((k) => k.q);
}
