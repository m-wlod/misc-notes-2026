import { XP } from "./config";
import type { LocalDate } from "./days";

/**
 * XP amounts and idempotency keys (Phase 14). A key makes an award happen at most once:
 * `xp_events.idempotency_key` is unique, so retries and double clicks can't add XP.
 */
export function exerciseXp({
  level,
  hintsUsed,
  firstTry,
  correct,
}: {
  level: number;
  hintsUsed: number;
  firstTry: boolean;
  correct: boolean;
}): number {
  if (!correct) return 0;
  const base = XP.exercisePerLevel * Math.min(5, Math.max(1, Math.round(level)));
  const share = Math.max(XP.hintFloor, 1 - XP.hintPenalty * Math.max(0, hintsUsed));
  const bonus = firstTry ? 1 + XP.firstTryBonus : 1;
  return Math.round(base * share * bonus);
}

/** The daily goal in XP for a goal set in minutes. */
export const goalXp = (minutes: number) => Math.max(1, Math.round(minutes)) * XP.perGoalMinute;

export type XpReason =
  "exercise" | "lesson" | "interview" | "daily_goal" | "streak_repair" | "correction";

export const xpKey = {
  /** One award per exercise, whichever variant was solved: no grinding through variants. */
  exercise: (id: string) => `exercise:${id}`,
  lesson: (id: string) => `lesson:${id}`,
  interview: (sessionId: string) => `interview:${sessionId}`,
  goal: (day: LocalDate) => `goal:${day}`,
  repair: (day: LocalDate) => `repair:${day}`,
  /** An accepted content error report (Phase 17), once per report. */
  correction: (reportId: number) => `correction:${String(reportId)}`,
};
