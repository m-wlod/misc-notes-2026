import { achievementById, newAchievements } from "../achievements";
import { STREAK, XP } from "../config";
import { leagueWeek, localDate, type LocalDate } from "../days";
import { factsFrom, goalAndRepairDays, type XpRow } from "../facts";
import { joinGroup, modeFor, tierOnReturn } from "../league";
import { updateRating } from "../rating";
import { replayStreak, type StreakState } from "../streak";
import { goalXp, xpKey, type XpReason } from "../xp";
import type { GamificationStore } from "./store";

/**
 * Awards XP and everything that follows from it (Phase 14): the daily goal, a streak
 * repair, the streak cache, this week's league row, topic ratings and achievements.
 * Idempotent: an event whose key was already awarded changes nothing. Called only from
 * server code, for the signed-in user.
 */
export type AwardEvent = {
  reason: Exclude<XpReason, "daily_goal" | "streak_repair">;
  amount: number;
  /** The event's own idempotency key (from `xpKey`), without the user id. */
  key: string;
  ref: string;
  /**
   * At most this many awards of this reason per local day. For events whose ids come
   * from the browser (interview sessions), so new ids can't farm XP.
   */
  dailyCap?: number;
};

export type Rewards = {
  xp: number;
  goalMet: boolean;
  repaired: boolean;
  streak: number;
  achievements: string[];
};

export type Lookups = {
  topicsOf: (exerciseId: string) => readonly string[];
  modulesCompleted: (lessonIds: ReadonlySet<string>) => number;
};

const userKey = (userId: string, key: string) => `${userId}:${key}`;

/** XP earned on a local day, not counting the goal and repair bonuses themselves. */
function dayXp(rows: readonly XpRow[], day: LocalDate, timeZone: string): number {
  return rows
    .filter((r) => r.reason !== "daily_goal" && r.reason !== "streak_repair")
    .filter((r) => localDate(new Date(r.createdAt), timeZone) === day)
    .reduce((sum, r) => sum + r.amount, 0);
}

/** Rating updates count every graded attempt, solved or not (no idempotency needed). */
export async function rateAttempt(
  store: GamificationStore,
  userId: string,
  rating: { topics: readonly string[]; level: number; score: number },
): Promise<void> {
  if (rating.topics.length === 0) return;
  const ratings = await store.ratings(userId);
  for (const topic of rating.topics) {
    ratings.set(topic, updateRating(ratings.get(topic) ?? 1000, rating.level, rating.score));
  }
  await store.saveRatings(userId, ratings);
}

export async function award(
  store: GamificationStore,
  userId: string,
  event: AwardEvent,
  lookups: Lookups,
  now: Date = new Date(),
): Promise<Rewards | null> {
  const profile = await store.profile(userId);
  if (!profile) return null;
  if (event.dailyCap !== undefined) {
    const today = localDate(now, profile.timeZone);
    const used = (await store.xpRows(userId)).filter(
      (r) =>
        r.reason === event.reason && localDate(new Date(r.createdAt), profile.timeZone) === today,
    ).length;
    if (used >= event.dailyCap) return null;
  }
  const inserted = await store.insertXp(userId, {
    amount: event.amount,
    reason: event.reason,
    ref: event.ref,
    key: userKey(userId, event.key),
    at: now,
  });
  if (!inserted) return null;
  return settle(store, userId, profile, lookups, now, event.amount);
}

/**
 * Everything after an XP row: goal, repair, streak, league, achievements. Also used by
 * achievement claims (with no XP of their own).
 */
export async function settle(
  store: GamificationStore,
  userId: string,
  profile: NonNullable<Awaited<ReturnType<GamificationStore["profile"]>>>,
  lookups: Lookups,
  now: Date,
  earned: number,
): Promise<Rewards> {
  const tz = profile.timeZone;
  const today = localDate(now, tz);
  const goal = goalXp(profile.dailyGoalMinutes);
  let rows = await store.xpRows(userId);
  let xp = earned;
  let goalMet = false;
  let repaired = false;

  const todayXp = dayXp(rows, today, tz);
  let { goals, repairs } = goalAndRepairDays(rows);
  if (todayXp >= goal && !goals.includes(today)) {
    const bonus = XP.dailyGoalMet;
    if (
      await store.insertXp(userId, {
        amount: bonus,
        reason: "daily_goal",
        ref: `day=${today}`,
        key: userKey(userId, xpKey.goal(today)),
        at: now,
      })
    ) {
      goalMet = true;
      xp += bonus;
    }
  }
  rows = await store.xpRows(userId);
  ({ goals, repairs } = goalAndRepairDays(rows));
  let streak: StreakState = replayStreak(goals, repairs, today);
  if (streak.repairable && todayXp >= goal * STREAK.repairGoalMultiple) {
    if (
      await store.insertXp(userId, {
        amount: 0,
        reason: "streak_repair",
        ref: `day=${today}`,
        key: userKey(userId, xpKey.repair(today)),
        at: now,
      })
    ) {
      repaired = true;
      rows = await store.xpRows(userId);
      ({ goals, repairs } = goalAndRepairDays(rows));
      streak = replayStreak(goals, repairs, today);
    }
  }
  await store.saveStreak(userId, streak);

  if (!profile.leagueOptOut) await joinLeague(store, userId, rows, now);

  const ratings = await store.ratings(userId);
  const facts = factsFrom({
    rows,
    streak,
    leagues: await store.leagueHistory(userId),
    maxRating: Math.max(0, ...ratings.values()),
    claims: [],
    ...lookups,
  });
  const owned = await store.ownedAchievements(userId);
  const fresh = newAchievements(facts, owned).filter((id) => !achievementById(id)?.client);
  if (fresh.length > 0) await store.grantAchievements(userId, fresh);

  return { xp, goalMet, repaired, streak: streak.current, achievements: fresh };
}

/** Keeps this week's league row: joins (tier from history) and sums the weekly XP. */
async function joinLeague(
  store: GamificationStore,
  userId: string,
  rows: readonly XpRow[],
  now: Date,
) {
  const week = leagueWeek(now);
  const weeklyXp = rows
    .filter((r) => leagueWeek(new Date(r.createdAt)) === week)
    .reduce((sum, r) => sum + r.amount, 0);
  const current = await store.membership(userId, week);
  if (current) {
    await store.upsertMembership({ ...current, weeklyXp });
    return;
  }
  const last = await store.lastMembership(userId, week);
  const tier = last
    ? tierOnReturn({
        tier: last.tier,
        finalRank: last.finalRank,
        groupSize: last.groupSize,
        weekActive: await store.weekActive(last.week),
      })
    : 1;
  const mode = modeFor(await store.weekActive(week));
  const group = joinGroup(await store.groupSizes(week, tier), mode);
  await store.upsertMembership({ userId, week, tier, group, weeklyXp });
}

/** A browser-claimed achievement (e.g. a simulation milestone): no XP, granted once. */
export async function claim(
  store: GamificationStore,
  userId: string,
  achievementId: string,
): Promise<boolean> {
  if (!achievementById(achievementId)?.client) return false;
  const owned = await store.ownedAchievements(userId);
  if (owned.has(achievementId)) return false;
  await store.grantAchievements(userId, [achievementId]);
  return true;
}
