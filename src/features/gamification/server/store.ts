import type { LocalDate } from "../days";
import type { LeagueRow, XpRow } from "../facts";
import type { StreakState } from "../streak";
import type { XpReason } from "../xp";

/**
 * Everything the award service reads and writes (Phase 14). Two implementations: an
 * in-memory one for unit tests and `supabaseStore` (secret-key client, server only).
 */
export type Profile = { timeZone: string; dailyGoalMinutes: number; leagueOptOut: boolean };

export type Membership = {
  userId: string;
  week: LocalDate;
  tier: number;
  group: number;
  weeklyXp: number;
  finalRank: number | null;
  joinedAt: number;
};

export interface GamificationStore {
  profile(userId: string): Promise<Profile | null>;
  /** Inserts once per key; false when the key already exists (nothing changes). */
  insertXp(
    userId: string,
    ev: { amount: number; reason: XpReason; ref: string; key: string; at: Date },
  ): Promise<boolean>;
  xpRows(userId: string): Promise<XpRow[]>;
  saveStreak(userId: string, s: StreakState): Promise<void>;

  membership(userId: string, week: LocalDate): Promise<Membership | null>;
  /** The latest membership before `week`, with its group's size. */
  lastMembership(
    userId: string,
    before: LocalDate,
  ): Promise<(Membership & { groupSize: number }) | null>;
  groupSizes(week: LocalDate, tier: number): Promise<Map<number, number>>;
  /** Members of `week` with weekly XP above zero. */
  weekActive(week: LocalDate): Promise<number>;
  upsertMembership(m: Omit<Membership, "finalRank" | "joinedAt">): Promise<void>;
  leagueHistory(userId: string): Promise<LeagueRow[]>;

  /** Every membership of a week (for the roll). */
  weekMembers(week: LocalDate): Promise<Membership[]>;
  /** Weeks before `before` that have members without a final rank. */
  unrolledWeeks(before: LocalDate): Promise<LocalDate[]>;
  saveRanks(week: LocalDate, ranks: { userId: string; rank: number }[]): Promise<void>;
  /** Next week's rows; existing rows for that week are left as they are. */
  insertMemberships(
    week: LocalDate,
    rows: { userId: string; tier: number; group: number }[],
  ): Promise<void>;
  optedOut(userIds: readonly string[]): Promise<Set<string>>;

  ratings(userId: string): Promise<Map<string, number>>;
  saveRatings(userId: string, ratings: Map<string, number>): Promise<void>;

  ownedAchievements(userId: string): Promise<Set<string>>;
  grantAchievements(userId: string, ids: readonly string[]): Promise<void>;
}
