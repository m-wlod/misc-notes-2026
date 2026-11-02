import { STREAK } from "./config";
import { addDays, daysBetween, mondayOf, type LocalDate } from "./days";

/**
 * The streak, worked out by replaying the days (Phase 14). The inputs are facts the
 * server records once each: the days the daily goal was met and the days a broken streak
 * was repaired (all in the user's time zone). Freezes are earned and spent during the
 * replay, so the result never depends on when or how often it is computed.
 *
 * - A day without the goal uses a stored freeze if there is one; otherwise the streak
 *   breaks.
 * - A freeze is earned each time the streak reaches a multiple of 7 days (max 2 stored).
 * - A broken streak can be repaired the next day (within 24 h of the missed day ending)
 *   by reaching twice the daily goal: the old streak continues.
 * - A perfect week: the goal met on all seven days, Monday to Sunday.
 */
export type StreakState = {
  current: number;
  longest: number;
  freezes: number;
  lastActive: LocalDate | null;
  freezesUsed: number;
  repairs: number;
  /** Today's goal isn't met yet and there is a streak to lose. */
  atRisk: boolean;
  /** Yesterday broke the streak and today can still repair it. */
  repairable: { lost: number } | null;
  /** Mondays of the weeks with the goal met every day. */
  perfectWeeks: LocalDate[];
};

export function replayStreak(
  goalDays: Iterable<LocalDate>,
  repairDays: Iterable<LocalDate>,
  today: LocalDate,
): StreakState {
  const goals = new Set([...goalDays].filter((d) => d <= today));
  const repairs = new Set([...repairDays].filter((d) => goals.has(d)));
  const empty: StreakState = {
    current: 0,
    longest: 0,
    freezes: 0,
    lastActive: null,
    freezesUsed: 0,
    repairs: 0,
    atRisk: false,
    repairable: null,
    perfectWeeks: [],
  };
  if (goals.size === 0) return empty;

  const first = [...goals].sort()[0] ?? today;
  const s = { ...empty };
  let broken: { lost: number; missed: LocalDate } | null = null;
  // Today's goal met without (yet) the doubled goal: the repair is still open today.
  let openRepair: { lost: number } | null = null;

  for (let d = first; daysBetween(d, today) >= 0; d = addDays(d, 1)) {
    if (goals.has(d)) {
      if (broken && repairs.has(d) && d === addDays(broken.missed, 1)) {
        s.current = broken.lost + 1;
        s.repairs += 1;
      } else {
        if (broken && d === today && d === addDays(broken.missed, 1)) {
          openRepair = { lost: broken.lost };
        }
        s.current += 1;
      }
      broken = null;
      s.lastActive = d;
      s.longest = Math.max(s.longest, s.current);
      if (s.current % STREAK.freezeEvery === 0) {
        s.freezes = Math.min(STREAK.maxFreezes, s.freezes + 1);
      }
      continue;
    }
    if (d === today) break; // today isn't over: nothing is lost yet
    if (s.current > 0) {
      if (s.freezes > 0) {
        s.freezes -= 1;
        s.freezesUsed += 1;
      } else {
        broken = { lost: s.current, missed: d };
        s.current = 0;
      }
    } else if (broken && d !== broken.missed) {
      broken = null; // a second missed day: too late to repair
    }
  }

  s.atRisk = s.current > 0 && !goals.has(today);
  s.repairable =
    openRepair ?? (broken && addDays(broken.missed, 1) === today ? { lost: broken.lost } : null);

  const mondays = new Set([...goals].map(mondayOf));
  s.perfectWeeks = [...mondays]
    .filter((m) => Array.from({ length: 7 }, (_, i) => addDays(m, i)).every((d) => goals.has(d)))
    .sort();
  return s;
}
