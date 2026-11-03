/**
 * What the landing page features (Phase 19). The simulation runs live instead of a hero
 * image; the exercise is the 60-second sample anyone can try without an account.
 * [you] pick both once real content is published. With `exercise: null` the first
 * visible level-1 exercise is used, and the block hides when there is none.
 */
export const LANDING = {
  simulation: "coin-walk",
  exercise: null as string | null,
  /** How many of the newest videos to list. */
  videos: 3,
} as const;
