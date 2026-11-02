import { LEAGUE } from "./config";

/**
 * Weekly leagues (Phase 14), pure. The cron rolls a finished week with `rollWeek`; the
 * award path places a newly active user with `joinGroup`.
 *
 * - Shared mode (fewer weekly active users than the threshold): each tier is one group
 *   and nobody moves. At launch everyone is in Bernoulli, so it's one shared league.
 * - Split mode: each tier is cut into groups of about 30 people with similar activity;
 *   the top 20% (who earned XP) go up a tier, the bottom 20% go down.
 * - Only people active in the finished week get a row next week; someone returning later
 *   joins in the tier their last week's outcome gave them.
 * - Opted-out users are never members (the caller leaves them out).
 */
export type Outcome = "promoted" | "stayed" | "demoted";
export type Member = {
  userId: string;
  tier: number;
  group: number;
  weeklyXp: number;
  /** When the user joined this week's league (ms), for ties. */
  joinedAt: number;
};
export type Ranked = Member & { rank: number; outcome: Outcome };
export type NextMember = { userId: string; tier: number; group: number };
export type LeagueConfig = Pick<
  typeof LEAGUE,
  "splitThreshold" | "groupSize" | "promoteShare" | "demoteShare" | "topTier"
>;

const byStanding = (a: Member, b: Member) =>
  b.weeklyXp - a.weeklyXp || a.joinedAt - b.joinedAt || (a.userId < b.userId ? -1 : 1);

export function modeFor(weeklyActive: number, cfg: LeagueConfig = LEAGUE) {
  return weeklyActive >= cfg.splitThreshold ? ("split" as const) : ("shared" as const);
}

/** Ranks one group (1 = best) and decides who moves. */
export function rankGroup(
  members: readonly Member[],
  mode: "shared" | "split",
  cfg: LeagueConfig = LEAGUE,
): Ranked[] {
  const sorted = [...members].sort(byStanding);
  const n = sorted.length;
  const up = mode === "split" ? Math.floor(n * cfg.promoteShare) : 0;
  const down = mode === "split" ? Math.floor(n * cfg.demoteShare) : 0;
  return sorted.map((m, i) => {
    let outcome: Outcome = "stayed";
    if (i < up && m.weeklyXp > 0 && m.tier < cfg.topTier) outcome = "promoted";
    else if (i >= n - down && m.tier > 1) outcome = "demoted";
    return { ...m, rank: i + 1, outcome };
  });
}

export const tierAfter = (tier: number, outcome: Outcome, cfg: LeagueConfig = LEAGUE) =>
  Math.min(
    cfg.topTier,
    Math.max(1, tier + (outcome === "promoted" ? 1 : outcome === "demoted" ? -1 : 0)),
  );

/** Cuts a tier into balanced groups of about `size`, keeping similar activity together. */
export function splitIntoGroups<T extends { weeklyXp: number; userId: string }>(
  people: readonly T[],
  size: number,
): T[][] {
  if (people.length === 0) return [];
  const count = Math.max(1, Math.round(people.length / size));
  const sorted = [...people].sort(
    (a, b) => b.weeklyXp - a.weeklyXp || (a.userId < b.userId ? -1 : 1),
  );
  const groups: T[][] = [];
  for (let g = 0; g < count; g++) {
    const from = Math.floor((g * sorted.length) / count);
    const to = Math.floor(((g + 1) * sorted.length) / count);
    groups.push(sorted.slice(from, to));
  }
  return groups;
}

export type RollResult = { mode: "shared" | "split"; ranked: Ranked[]; next: NextMember[] };

/** Closes a finished week: final ranks and outcomes, and next week's memberships. */
export function rollWeek(
  members: readonly Member[],
  weeklyActive: number,
  cfg: LeagueConfig = LEAGUE,
): RollResult {
  const mode = modeFor(weeklyActive, cfg);
  const groups = new Map<string, Member[]>();
  for (const m of members) {
    const key = `${String(m.tier)}:${String(m.group)}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const ranked = [...groups.values()].flatMap((g) => rankGroup(g, mode, cfg));

  // Next week: everyone active this week, in their new tier.
  const nextMode = mode; // the same count decides how next week is laid out
  const byTier = new Map<number, (Ranked & { nextTier: number })[]>();
  for (const r of ranked) {
    if (r.weeklyXp <= 0) continue;
    const nextTier = tierAfter(r.tier, r.outcome, cfg);
    byTier.set(nextTier, [...(byTier.get(nextTier) ?? []), { ...r, nextTier }]);
  }
  const next: NextMember[] = [];
  for (const [tier, people] of [...byTier.entries()].sort((a, b) => a[0] - b[0])) {
    const groupsOfTier = nextMode === "split" ? splitIntoGroups(people, cfg.groupSize) : [people];
    groupsOfTier.forEach((g, i) => {
      for (const p of g) next.push({ userId: p.userId, tier, group: i + 1 });
    });
  }
  return { mode, ranked, next };
}

/**
 * Where someone joins mid-week: the smallest group of their tier with room, or a new
 * group (in shared mode, the tier's single group).
 */
export function joinGroup(
  sizes: ReadonlyMap<number, number>,
  mode: "shared" | "split",
  cfg: LeagueConfig = LEAGUE,
): number {
  if (mode === "shared" || sizes.size === 0) return 1;
  let best: number | null = null;
  for (const [group, size] of sizes) {
    if (size >= cfg.groupSize) continue;
    if (
      best === null ||
      size < (sizes.get(best) ?? Infinity) ||
      (size === sizes.get(best) && group < best)
    )
      best = group;
  }
  return best ?? Math.max(...sizes.keys()) + 1;
}

/**
 * The tier for someone returning after weeks away: their last week's tier, one lower if
 * that week's final rank was in the demotion zone (inactive learners can't be promoted).
 * `weekActive` decides whether that week was shared (nobody moved) or split.
 */
export function tierOnReturn(
  last: { tier: number; finalRank: number | null; groupSize: number; weekActive: number },
  cfg: LeagueConfig = LEAGUE,
): number {
  if (last.finalRank === null || modeFor(last.weekActive, cfg) === "shared") return last.tier;
  const down = Math.floor(last.groupSize * cfg.demoteShare);
  return last.finalRank > last.groupSize - down ? Math.max(1, last.tier - 1) : last.tier;
}
