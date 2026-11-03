/**
 * Every number of the game in one place (Phase 14). Tune here, nowhere else.
 * First drafts, marked for review in docs/PROGRESS.md.
 */
export const XP = {
  lessonCompleted: 20,
  /** Exercise base XP per level (level 3 → 30). */
  exercisePerLevel: 10,
  /** Each hint used takes this share of the base... */
  hintPenalty: 0.25,
  /** ...down to this share of it. */
  hintFloor: 0.2,
  /** Correct on the first attempt at this exercise. */
  firstTryBonus: 0.5,
  interviewSession: 30,
  /** Interview sessions are finished in the browser: XP for at most this many a day. */
  interviewSessionsPerDay: 5,
  dailyGoalMet: 20,
  /** A content error report a moderator accepted (Phase 17). */
  correctionAccepted: 50,
  /** The daily goal is set in minutes (5, 10, 20); this many XP stand for a minute. */
  perGoalMinute: 5,
} as const;

export const STREAK = {
  /** A freeze is earned each time the streak reaches a multiple of this many days. */
  freezeEvery: 7,
  maxFreezes: 2,
  /** A broken streak is repaired by reaching this multiple of the goal the next day. */
  repairGoalMultiple: 2,
} as const;

/** Tiers, lowest first. Ids and slugs match the `leagues` rows. */
export const TIERS = [
  { id: 1, slug: "bernoulli" },
  { id: 2, slug: "gauss" },
  { id: 3, slug: "markov" },
  { id: 4, slug: "kolmogorov" },
  { id: 5, slug: "ito" },
  { id: 6, slug: "black-scholes" },
] as const;
export type TierId = (typeof TIERS)[number]["id"];

export const LEAGUE = {
  /** Below this many weekly active users there is one shared league (no groups, no moves). */
  splitThreshold: 60,
  groupSize: 30,
  promoteShare: 0.2,
  demoteShare: 0.2,
  /** League weeks start on Monday 00:00 in this zone, for everyone. */
  timeZone: "Europe/Warsaw",
  topTier: 6,
} as const;

export const ELO = {
  start: 1000,
  k: 32,
  /** Difficulty of an exercise: base + perLevel × level (level 1 → 1000, level 5 → 1800). */
  difficultyBase: 800,
  difficultyPerLevel: 200,
  /** Recommend exercises this far above the current rating (a little stretch). */
  stretch: 50,
} as const;
