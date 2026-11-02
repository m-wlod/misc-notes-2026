import type { LeagueRow, XpRow } from "../facts";
import type { StreakState } from "../streak";
import type { GamificationStore, Membership, Profile } from "./store";

/** An in-memory store with the same semantics as the database (for unit tests). */
export function memoryStore(profiles: Record<string, Profile>) {
  const xp: (XpRow & { userId: string; key: string })[] = [];
  const streaks = new Map<string, StreakState>();
  const members: Membership[] = [];
  const ratings = new Map<string, Map<string, number>>();
  const achievements = new Map<string, Set<string>>();
  let joined = 0;

  const store: GamificationStore = {
    profile: (userId) => Promise.resolve(profiles[userId] ?? null),
    insertXp(userId, ev) {
      if (xp.some((r) => r.key === ev.key)) return Promise.resolve(false);
      xp.push({
        userId,
        key: ev.key,
        amount: ev.amount,
        reason: ev.reason,
        ref: ev.ref,
        createdAt: ev.at.toISOString(),
      });
      return Promise.resolve(true);
    },
    xpRows: (userId) =>
      Promise.resolve(
        xp
          .filter((r) => r.userId === userId)
          .map(({ amount, reason, ref, createdAt }) => ({ amount, reason, ref, createdAt })),
      ),
    saveStreak(userId, s) {
      streaks.set(userId, s);
      return Promise.resolve();
    },
    membership: (userId, week) =>
      Promise.resolve(members.find((m) => m.userId === userId && m.week === week) ?? null),
    lastMembership(userId, before) {
      const last = members
        .filter((m) => m.userId === userId && m.week < before)
        .sort((a, b) => (a.week < b.week ? 1 : -1))[0];
      if (!last) return Promise.resolve(null);
      const groupSize = members.filter(
        (m) => m.week === last.week && m.tier === last.tier && m.group === last.group,
      ).length;
      return Promise.resolve({ ...last, groupSize });
    },
    groupSizes(week, tier) {
      const sizes = new Map<number, number>();
      for (const m of members.filter((x) => x.week === week && x.tier === tier)) {
        sizes.set(m.group, (sizes.get(m.group) ?? 0) + 1);
      }
      return Promise.resolve(sizes);
    },
    weekActive: (week) =>
      Promise.resolve(members.filter((m) => m.week === week && m.weeklyXp > 0).length),
    upsertMembership(m) {
      const i = members.findIndex((x) => x.userId === m.userId && x.week === m.week);
      if (i >= 0) members[i] = { ...(members[i] as Membership), ...m };
      else members.push({ ...m, finalRank: null, joinedAt: joined++ });
      return Promise.resolve();
    },
    leagueHistory: (userId) =>
      Promise.resolve(
        members
          .filter((m) => m.userId === userId)
          .map((m): LeagueRow => ({ week: m.week, tier: m.tier, finalRank: m.finalRank })),
      ),
    weekMembers: (week) => Promise.resolve(members.filter((m) => m.week === week)),
    unrolledWeeks: (before) =>
      Promise.resolve([
        ...new Set(
          members.filter((m) => m.week < before && m.finalRank === null).map((m) => m.week),
        ),
      ]),
    saveRanks(week, ranks) {
      for (const r of ranks) {
        const m = members.find((x) => x.week === week && x.userId === r.userId);
        if (m) m.finalRank = r.rank;
      }
      return Promise.resolve();
    },
    insertMemberships(week, rows) {
      for (const r of rows) {
        if (members.some((m) => m.week === week && m.userId === r.userId)) continue;
        members.push({ ...r, week, weeklyXp: 0, finalRank: null, joinedAt: joined++ });
      }
      return Promise.resolve();
    },
    optedOut: (ids) => Promise.resolve(new Set(ids.filter((id) => profiles[id]?.leagueOptOut))),
    ratings: (userId) => Promise.resolve(new Map(ratings.get(userId) ?? [])),
    saveRatings(userId, r) {
      ratings.set(userId, new Map(r));
      return Promise.resolve();
    },
    ownedAchievements: (userId) => Promise.resolve(new Set(achievements.get(userId) ?? [])),
    grantAchievements(userId, ids) {
      achievements.set(userId, new Set([...(achievements.get(userId) ?? []), ...ids]));
      return Promise.resolve();
    },
  };
  return { store, xp, streaks, members, ratings, achievements };
}
