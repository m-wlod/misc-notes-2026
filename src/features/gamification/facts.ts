import { EMPTY_FACTS, type Facts } from "./achievements";
import type { LocalDate } from "./days";
import type { StreakState } from "./streak";
import type { XpReason } from "./xp";

/**
 * What an XP row says about the learner (Phase 14). Each `xp_events` row carries its
 * details in `ref` (`key=value;…`, ≤160 chars), so achievements, streaks and goals are
 * all derived from the XP log plus league rows. No extra columns.
 */
export type XpRow = { amount: number; reason: XpReason; ref: string | null; createdAt: string };

export function encodeRef(fields: Record<string, string | number | boolean>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}=${typeof v === "boolean" ? (v ? "1" : "0") : String(v)}`)
    .join(";")
    .slice(0, 160);
}

export function parseRef(ref: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (ref ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

/** The days recorded by daily-goal and repair rows. */
export function goalAndRepairDays(rows: readonly XpRow[]) {
  const goals: LocalDate[] = [];
  const repairs: LocalDate[] = [];
  for (const r of rows) {
    const day = parseRef(r.ref).day;
    if (!day) continue;
    if (r.reason === "daily_goal") goals.push(day);
    else if (r.reason === "streak_repair") repairs.push(day);
  }
  return { goals, repairs };
}

export type LeagueRow = { week: LocalDate; tier: number; finalRank: number | null };

export function factsFrom(input: {
  rows: readonly XpRow[];
  streak: StreakState;
  leagues: readonly LeagueRow[];
  maxRating: number;
  claims: readonly string[];
  /** Topics of an exercise (for the Kelly achievement). */
  topicsOf: (exerciseId: string) => readonly string[];
  /** How many curriculum modules these completed lessons finish. */
  modulesCompleted: (lessonIds: ReadonlySet<string>) => number;
  debunkFinished?: number;
}): Facts {
  const f = {
    ...EMPTY_FACTS,
    solvedTypes: [] as string[],
    interviewKinds: [] as string[],
  };
  const lessons = new Set<string>();
  for (const r of input.rows) {
    f.totalXp += r.amount;
    const ref = parseRef(r.ref);
    if (r.reason === "exercise") {
      f.solved += 1;
      if (ref.f === "1") f.firstTry += 1;
      if (ref.h === "0") f.noHint += 1;
      f.maxSolvedLevel = Math.max(f.maxSolvedLevel, Number(ref.l ?? 0));
      if (ref.t && !f.solvedTypes.includes(ref.t)) f.solvedTypes.push(ref.t);
      if (ref.f === "1" && ref.id && input.topicsOf(ref.id).includes("kelly")) {
        f.kellyFirstTry = true;
      }
    } else if (r.reason === "lesson" && ref.id) {
      lessons.add(ref.id);
    } else if (r.reason === "interview" && ref.kind) {
      if (!f.interviewKinds.includes(ref.kind)) f.interviewKinds.push(ref.kind);
      if (ref.kind === "mental_math" && ref.pb === "1") f.mentalMathPersonalBest = true;
      if (ref.kind === "market_making" && ref.profit === "1") f.marketMakingProfit = true;
    }
  }
  f.lessonsCompleted = lessons.size;
  f.modulesCompleted = input.modulesCompleted(lessons);
  f.streakLongest = input.streak.longest;
  f.freezesUsed = input.streak.freezesUsed;
  f.repairs = input.streak.repairs;
  f.perfectWeeks = input.streak.perfectWeeks.length;

  const weeks = [...input.leagues].sort((a, b) => (a.week < b.week ? -1 : 1));
  for (let i = 1; i < weeks.length; i++) {
    if ((weeks[i]?.tier ?? 0) > (weeks[i - 1]?.tier ?? 0)) f.promotions += 1;
  }
  // Rank 0 marks a week closed for someone who had opted out.
  const ranks = weeks.map((w) => w.finalRank).filter((r): r is number => r !== null && r > 0);
  f.bestRank = ranks.length ? Math.min(...ranks) : null;
  f.maxTier = Math.max(1, ...weeks.map((w) => w.tier));
  f.maxRating = input.maxRating;
  f.debunkFinished = input.debunkFinished ?? 0;
  f.claims = input.claims;
  return f;
}
