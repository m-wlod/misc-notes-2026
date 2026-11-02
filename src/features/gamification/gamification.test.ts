import { describe, expect, it } from "vitest";

import { currentChallenge } from "@/features/challenge/current";
import { mulberry32 } from "@/lib/math/rng";

import { ACHIEVEMENTS, EMPTY_FACTS, newAchievements, type Facts } from "./achievements";
import { LEAGUE, STREAK, XP } from "./config";
import {
  dailyKey,
  grid,
  MAX_ATTEMPTS,
  parseDaily,
  shareParams,
  solved,
  withAttempt as withDailyAttempt,
} from "./daily";
import { addDays, daysBetween, leagueWeek, localDate, mondayOf, weekday } from "./days";
import { joinGroup, rankGroup, rollWeek, splitIntoGroups, tierAfter, type Member } from "./league";
import { difficulty, expectedScore, recommend, updateRating } from "./rating";
import { replayStreak } from "./streak";
import { goalShare, nextLesson, pickOfDay } from "./today";
import { exerciseXp, goalXp, xpKey } from "./xp";

const at = (iso: string) => new Date(iso);
const WAW = "Europe/Warsaw";

describe("days and time zones", () => {
  it("midnight in Warsaw vs UTC", () => {
    // 23:30 in Warsaw (winter, UTC+1) is 22:30 UTC: the same day in both.
    expect(localDate(at("2026-01-14T22:30:00Z"), WAW)).toBe("2026-01-14");
    expect(localDate(at("2026-01-14T22:30:00Z"), "UTC")).toBe("2026-01-14");
    // 00:30 in Warsaw is still 23:30 the day before in UTC.
    expect(localDate(at("2026-01-14T23:30:00Z"), WAW)).toBe("2026-01-15");
    expect(localDate(at("2026-01-14T23:30:00Z"), "UTC")).toBe("2026-01-14");
    // Summer time (UTC+2): 00:30 Warsaw is 22:30 UTC.
    expect(localDate(at("2026-07-14T22:30:00Z"), WAW)).toBe("2026-07-15");
  });

  it("DST changes: a 23-hour and a 25-hour day are each one day", () => {
    // 2026-03-29: clocks go forward in Warsaw (02:00 → 03:00). The day has 23 hours.
    const startMarch = at("2026-03-28T23:00:00Z"); // 00:00 on the 29th, UTC+1
    const endMarch = at("2026-03-29T21:59:59Z"); // 23:59:59 on the 29th, UTC+2
    expect(localDate(startMarch, WAW)).toBe("2026-03-29");
    expect(localDate(endMarch, WAW)).toBe("2026-03-29");
    expect(localDate(at("2026-03-29T22:00:00Z"), WAW)).toBe("2026-03-30");
    expect((endMarch.getTime() - startMarch.getTime() + 1000) / 3_600_000).toBe(23);
    // 2026-10-25: clocks go back (03:00 → 02:00). The day has 25 hours.
    const startOct = at("2026-10-24T22:00:00Z"); // 00:00 on the 25th, UTC+2
    const endOct = at("2026-10-25T22:59:59Z"); // 23:59:59 on the 25th, UTC+1
    expect(localDate(startOct, WAW)).toBe("2026-10-25");
    expect(localDate(endOct, WAW)).toBe("2026-10-25");
    expect((endOct.getTime() - startOct.getTime() + 1000) / 3_600_000).toBe(25);
    // Date arithmetic ignores clock changes.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(daysBetween("2026-03-28", "2026-03-31")).toBe(3);
    expect(daysBetween("2026-10-24", "2026-10-27")).toBe(3);
  });

  it("one instant, different days around the world; bad zones fall back to Warsaw", () => {
    const instant = at("2026-05-01T03:00:00Z");
    expect(localDate(instant, "America/New_York")).toBe("2026-04-30");
    expect(localDate(instant, "Asia/Tokyo")).toBe("2026-05-01");
    expect(localDate(instant, "Not/AZone")).toBe(localDate(instant, WAW));
  });

  it("league weeks start on Monday 00:00 in Warsaw, for everyone", () => {
    expect(weekday("2026-11-02")).toBe(1);
    expect(weekday("2026-11-08")).toBe(7);
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    // Sunday 23:59 Warsaw (UTC+1 in November) is still last week...
    expect(leagueWeek(at("2026-11-08T22:59:00Z"))).toBe("2026-11-02");
    // ...one minute later it's the new week, though it's still Sunday in UTC.
    expect(leagueWeek(at("2026-11-08T23:00:00Z"))).toBe("2026-11-09");
    // The week containing the October DST change.
    expect(leagueWeek(at("2026-10-25T12:00:00Z"))).toBe("2026-10-19");
  });
});

describe("XP", () => {
  it("scales by level, takes off for hints down to a floor, adds a first-try bonus", () => {
    const base = (level: number) => XP.exercisePerLevel * level;
    expect(exerciseXp({ level: 3, hintsUsed: 0, firstTry: false, correct: true })).toBe(base(3));
    expect(exerciseXp({ level: 3, hintsUsed: 0, firstTry: true, correct: true })).toBe(45);
    expect(exerciseXp({ level: 4, hintsUsed: 1, firstTry: false, correct: true })).toBe(30);
    expect(exerciseXp({ level: 4, hintsUsed: 2, firstTry: false, correct: true })).toBe(20);
    // Many hints: never below the floor.
    expect(exerciseXp({ level: 5, hintsUsed: 9, firstTry: false, correct: true })).toBe(10);
    expect(exerciseXp({ level: 5, hintsUsed: 0, firstTry: true, correct: false })).toBe(0);
    // Out-of-range levels are clamped.
    expect(exerciseXp({ level: 9, hintsUsed: 0, firstTry: false, correct: true })).toBe(base(5));
  });

  it("goal in XP per goal setting, and one key per thing", () => {
    expect([5, 10, 20].map(goalXp)).toEqual([25, 50, 100]);
    expect(xpKey.exercise("ev-coin")).toBe("exercise:ev-coin");
    expect(xpKey.goal("2026-11-02")).toBe("goal:2026-11-02");
    expect(new Set([xpKey.lesson("a"), xpKey.exercise("a"), xpKey.interview("a")]).size).toBe(3);
  });
});

const days = (from: string, n: number, skip: number[] = []) =>
  Array.from({ length: n }, (_, i) => addDays(from, i)).filter((_, i) => !skip.includes(i));

describe("streak", () => {
  it("counts consecutive goal days; today not done yet means at risk, not lost", () => {
    const s = replayStreak(days("2026-11-01", 3), [], "2026-11-04");
    expect(s).toMatchObject({ current: 3, longest: 3, atRisk: true, lastActive: "2026-11-03" });
    expect(replayStreak(days("2026-11-01", 4), [], "2026-11-04")).toMatchObject({
      current: 4,
      atRisk: false,
    });
    expect(replayStreak([], [], "2026-11-04")).toMatchObject({ current: 0, longest: 0 });
  });

  it("a missed day without a freeze breaks it; longest is kept", () => {
    const goals = [...days("2026-11-01", 5), ...days("2026-11-07", 2)]; // misses the 6th
    // On the 9th the new streak (7th, 8th) is at risk; by the 10th the 9th was missed too.
    expect(replayStreak(goals, [], "2026-11-09")).toMatchObject({
      current: 2,
      longest: 5,
      atRisk: true,
    });
    expect(replayStreak(goals, [], "2026-11-10")).toMatchObject({
      current: 0,
      longest: 5,
      freezesUsed: 0,
    });
  });

  it("freezes: earned every 7 days, at most 2, spent on missed days", () => {
    // 14 days → 2 freezes; then 2 missed days are covered; a 3rd breaks it.
    const goals = days("2026-11-01", 14);
    expect(replayStreak(goals, [], "2026-11-15").freezes).toBe(STREAK.maxFreezes);
    const covered = replayStreak(goals, [], "2026-11-17");
    expect(covered).toMatchObject({ current: 14, freezes: 0, freezesUsed: 2 });
    expect(replayStreak(goals, [], "2026-11-18")).toMatchObject({ current: 0, longest: 14 });
    // 21 days would earn a third: still capped at 2.
    expect(replayStreak(days("2026-11-01", 21), [], "2026-11-21").freezes).toBe(2);
  });

  it("repair: possible the day after the miss, not later; restores the old streak", () => {
    const before = days("2026-11-01", 5); // 1st–5th; the 6th is missed
    // On the 7th, before doing anything: repairable.
    expect(replayStreak(before, [], "2026-11-07").repairable).toEqual({ lost: 5 });
    // Goal met on the 7th, but not doubled yet: still repairable today.
    const goalOnly = replayStreak([...before, "2026-11-07"], [], "2026-11-07");
    expect(goalOnly).toMatchObject({ current: 1, repairable: { lost: 5 } });
    // Doubled goal on the 7th, recorded as a repair: the streak continues.
    const repaired = replayStreak([...before, "2026-11-07"], ["2026-11-07"], "2026-11-07");
    expect(repaired).toMatchObject({ current: 6, repairs: 1, repairable: null });
    // On the 8th it's too late.
    expect(replayStreak(before, [], "2026-11-08").repairable).toBeNull();
    // A repair recorded on the wrong day doesn't count.
    expect(replayStreak([...before, "2026-11-08"], ["2026-11-08"], "2026-11-08").current).toBe(1);
  });

  it("perfect weeks are Monday–Sunday, also across a DST change", () => {
    // Monday 2026-10-19 to Sunday 2026-10-25 (the clocks go back on Sunday).
    const week = days("2026-10-19", 7);
    expect(replayStreak(week, [], "2026-10-26").perfectWeeks).toEqual(["2026-10-19"]);
    expect(replayStreak(days("2026-10-19", 7, [3]), [], "2026-10-26").perfectWeeks).toEqual([]);
    // Seven days that straddle two weeks aren't a perfect week.
    expect(replayStreak(days("2026-10-21", 7), [], "2026-10-28").perfectWeeks).toEqual([]);
  });

  it("the user's zone decides the day: a late-night session in New York", () => {
    // 23:30 New York on the 3rd is 04:30 UTC on the 4th.
    const day = localDate(at("2026-11-04T04:30:00Z"), "America/New_York");
    expect(day).toBe("2026-11-03");
    const s = replayStreak(["2026-11-01", "2026-11-02", day], [], "2026-11-03");
    expect(s.current).toBe(3);
  });
});

describe("leagues", () => {
  const member = (i: number, xp: number, tier = 1, group = 1): Member => ({
    userId: `u${String(i).padStart(3, "0")}`,
    tier,
    group,
    weeklyXp: xp,
    joinedAt: i,
  });

  it("shared below the threshold: ranks only, nobody moves", () => {
    const members = Array.from({ length: 40 }, (_, i) => member(i, 100 - i));
    const res = rollWeek(members, LEAGUE.splitThreshold - 1);
    expect(res.mode).toBe("shared");
    expect(res.ranked.every((r) => r.outcome === "stayed")).toBe(true);
    expect(new Set(res.next.map((n) => n.group))).toEqual(new Set([1]));
    expect(res.next.every((n) => n.tier === 1)).toBe(true);
  });

  it("split at the threshold: top 20% up, bottom 20% down, clamped at the ends", () => {
    const g = Array.from({ length: 30 }, (_, i) => member(i, 300 - i * 10, 3));
    const ranked = rankGroup(g, "split");
    expect(ranked.filter((r) => r.outcome === "promoted").map((r) => r.rank)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(ranked.filter((r) => r.outcome === "demoted").map((r) => r.rank)).toEqual([
      25, 26, 27, 28, 29, 30,
    ]);
    // Top tier can't go up; Bernoulli can't go down.
    expect(
      rankGroup(
        g.map((m) => ({ ...m, tier: 6 })),
        "split",
      ).some((r) => r.outcome === "promoted"),
    ).toBe(false);
    expect(
      rankGroup(
        g.map((m) => ({ ...m, tier: 1 })),
        "split",
      ).some((r) => r.outcome === "demoted"),
    ).toBe(false);
    // Nobody is promoted without XP.
    const idle = rankGroup(
      Array.from({ length: 10 }, (_, i) => member(i, 0, 2)),
      "split",
    );
    expect(idle.some((r) => r.outcome === "promoted")).toBe(false);
    expect(tierAfter(6, "promoted")).toBe(6);
    expect(tierAfter(1, "demoted")).toBe(1);
  });

  it("ties: earlier joiner first, then user id", () => {
    const ranked = rankGroup([member(5, 50), member(2, 50), member(9, 80)], "split");
    expect(ranked.map((r) => r.userId)).toEqual(["u009", "u002", "u005"]);
  });

  it("groups are balanced around 30 and keep similar activity together", () => {
    const people = Array.from({ length: 95 }, (_, i) => member(i, 1000 - i));
    const groups = splitIntoGroups(people, 30);
    expect(groups.map((g) => g.length)).toEqual([31, 32, 32]);
    expect(groups[0]?.[0]?.weeklyXp).toBe(1000);
    expect(splitIntoGroups(people.slice(0, 44), 30).map((g) => g.length)).toEqual([44]);
    expect(splitIntoGroups(people.slice(0, 46), 30).map((g) => g.length)).toEqual([23, 23]);
  });

  it("mid-week joins go to the smallest group with room", () => {
    expect(joinGroup(new Map(), "split")).toBe(1);
    expect(
      joinGroup(
        new Map([
          [1, 30],
          [2, 12],
          [3, 12],
        ]),
        "split",
      ),
    ).toBe(2);
    expect(
      joinGroup(
        new Map([
          [1, 30],
          [2, 30],
        ]),
        "split",
      ),
    ).toBe(3);
    expect(joinGroup(new Map([[1, 400]]), "shared")).toBe(1);
  });

  it("a simulated week of 150 learners produces the right league", () => {
    const rand = mulberry32(14);
    const weekStart = Date.parse("2026-11-01T23:00:00Z"); // Monday 2026-11-02 00:00 Warsaw
    const weekEnd = Date.parse("2026-11-08T23:00:00Z"); // next Monday 00:00 Warsaw
    const profiles = ["inactive", "casual", "regular", "heavy"] as const;
    const users = Array.from({ length: 150 }, (_, i) => ({
      id: `u${String(i).padStart(3, "0")}`,
      profile: profiles[i % 4] ?? "casual",
      tier: 1 + (i % 3),
    }));
    // Activity as timestamped exercise solves, including some right at the week's edges.
    const events: { user: string; at: number; xp: number }[] = [];
    for (const u of users) {
      const solves = { inactive: 0, casual: 3, regular: 10, heavy: 25 }[u.profile];
      for (let k = 0; k < solves; k++) {
        const level = 1 + Math.floor(rand() * 5);
        events.push({
          user: u.id,
          at: weekStart + Math.floor(rand() * (weekEnd - weekStart)),
          xp: exerciseXp({
            level,
            hintsUsed: Math.floor(rand() * 3),
            firstTry: rand() < 0.5,
            correct: true,
          }),
        });
      }
    }
    events.push({ user: "u001", at: weekEnd - 60_000, xp: 1000 }); // Sunday 23:59: counts
    events.push({ user: "u002", at: weekEnd, xp: 5000 }); // Monday 00:00: next week
    events.push({ user: "u003", at: weekStart - 1, xp: 5000 }); // last week: doesn't count

    const week = leagueWeek(weekStart);
    const weekly = new Map<string, number>();
    for (const e of events) {
      if (leagueWeek(e.at) !== week) continue;
      weekly.set(e.user, (weekly.get(e.user) ?? 0) + e.xp);
    }
    // This week's memberships: everyone with an existing row, grouped within tiers.
    const members: Member[] = [];
    for (const tier of [1, 2, 3]) {
      const ofTier = users.filter((u) => u.tier === tier);
      splitIntoGroups(
        ofTier.map((u) => ({ userId: u.id, weeklyXp: 0 })),
        LEAGUE.groupSize,
      ).forEach((g, gi) => {
        for (const p of g) {
          members.push({
            userId: p.userId,
            tier,
            group: gi + 1,
            weeklyXp: weekly.get(p.userId) ?? 0,
            joinedAt: 0,
          });
        }
      });
    }
    const active = members.filter((m) => m.weeklyXp > 0).length;
    expect(active).toBe(150 - 38); // every 4th user (38 of 150) is inactive
    expect(weekly.get("u002")).toBeLessThan(5000); // the Monday 00:00 event isn't in
    expect(weekly.get("u001")).toBeGreaterThanOrEqual(1000);

    const res = rollWeek(members, active);
    expect(res.mode).toBe("split");

    // Every group: ranks 1..n, the right number up and down, by standing.
    const groups = new Map<string, typeof res.ranked>();
    for (const r of res.ranked) {
      const key = `${String(r.tier)}:${String(r.group)}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    for (const g of groups.values()) {
      const n = g.length;
      expect(g.map((r) => r.rank).sort((a, b) => a - b)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
      const byRank = [...g].sort((a, b) => a.rank - b.rank);
      for (let i = 1; i < n; i++) {
        expect(byRank[i - 1]?.weeklyXp ?? 0).toBeGreaterThanOrEqual(byRank[i]?.weeklyXp ?? 0);
      }
      const tier = g[0]?.tier ?? 1;
      const ups = byRank.filter((r) => r.outcome === "promoted");
      const downs = byRank.filter((r) => r.outcome === "demoted");
      expect(ups.length).toBe(
        byRank.slice(0, Math.floor(n * 0.2)).filter((r) => r.weeklyXp > 0).length,
      );
      expect(ups.every((r) => r.rank <= Math.floor(n * 0.2))).toBe(true);
      expect(downs.length).toBe(tier > 1 ? Math.floor(n * 0.2) : 0);
      expect(downs.every((r) => r.rank > n - Math.floor(n * 0.2))).toBe(true);
    }
    // Next week: only active learners, in their new tier, in groups of about 30.
    const nextIds = new Set(res.next.map((n) => n.userId));
    expect(nextIds.size).toBe(active);
    for (const r of res.ranked) {
      const n = res.next.find((x) => x.userId === r.userId);
      if (r.weeklyXp === 0) expect(n).toBeUndefined();
      else expect(n?.tier).toBe(tierAfter(r.tier, r.outcome));
    }
    // Each tier: max(1, round(n / 30)) groups whose sizes differ by at most one.
    const nextByTier = new Map<number, Map<number, number>>();
    for (const n of res.next) {
      const groupsOfTier = nextByTier.get(n.tier) ?? new Map<number, number>();
      groupsOfTier.set(n.group, (groupsOfTier.get(n.group) ?? 0) + 1);
      nextByTier.set(n.tier, groupsOfTier);
    }
    for (const groupsOfTier of nextByTier.values()) {
      const sizes = [...groupsOfTier.values()];
      const total = sizes.reduce((a, b) => a + b, 0);
      expect(sizes.length).toBe(Math.max(1, Math.round(total / LEAGUE.groupSize)));
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
    // Rolling the same week again gives the same result.
    expect(rollWeek(members, active)).toEqual(res);
  });
});

describe("skill rating", () => {
  it("expected score is symmetric and the rating moves toward the result", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
    expect(expectedScore(1400, 1200) + expectedScore(1200, 1400)).toBeCloseTo(1);
    expect(updateRating(1000, 1, 1)).toBeCloseTo(1016); // even match, won
    expect(updateRating(1000, 1, 0)).toBeCloseTo(984);
    // Solving level-3 exercises (difficulty 1400) every time converges toward and past it.
    let r = 1000;
    for (let i = 0; i < 200; i++) r = updateRating(r, 3, 1);
    expect(r).toBeGreaterThan(difficulty(3));
  });

  it("recommends an unsolved exercise in the weakest topic near the rating", () => {
    const ex = [
      { id: "a1", level: 1, topics: ["prob"] },
      { id: "a3", level: 3, topics: ["prob"] },
      { id: "b1", level: 1, topics: ["stats"] },
      { id: "b2", level: 2, topics: ["stats"] },
      { id: "b4", level: 4, topics: ["stats"] },
    ];
    const ratings = new Map([
      ["prob", 1450],
      ["stats", 1180],
    ]);
    // Weakest topic is stats (1180); +50 stretch → 1230, nearest is level 2 (1200).
    expect(recommend(ratings, ex, new Set())?.id).toBe("b2");
    expect(recommend(ratings, ex, new Set(["b2"]))?.id).toBe("b1");
    // Stats all solved: falls to the next topic.
    expect(recommend(ratings, ex, new Set(["b1", "b2", "b4"]))?.id).toBe("a3");
    expect(recommend(new Map(), ex, new Set())?.level).toBe(1);
    expect(recommend(ratings, ex, new Set(ex.map((e) => e.id)))).toBeNull();
  });
});

describe("achievements", () => {
  const facts = (over: Partial<Facts>): Facts => ({ ...EMPTY_FACTS, ...over });
  const earned = (over: Partial<Facts>, owned: string[] = []) =>
    newAchievements(facts(over), new Set(owned));

  it("has at least 30, unique ids in the catalog's format", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{2,60}$/);
  });

  it("nothing for a new learner", () => {
    expect(earned({})).toEqual([]);
  });

  it.each([
    ["pierwszy-krok", { solved: 0 }, { solved: 1 }],
    ["setka", { solved: 99 }, { solved: 100 }],
    ["xp-1000", { totalXp: 999 }, { totalXp: 1000 }],
    ["seria-7", { streakLongest: 6 }, { streakLongest: 7 }],
    ["seria-365", { streakLongest: 364 }, { streakLongest: 365 }],
    ["za-pierwszym-razem", { firstTry: 9 }, { firstTry: 10 }],
    ["bez-podpowiedzi", { noHint: 24 }, { noHint: 25 }],
    ["poziom-piaty", { maxSolvedLevel: 4 }, { maxSolvedLevel: 5 }],
    ["podium", { bestRank: 4 }, { bestRank: 3 }],
    ["black-scholes", { maxTier: 5 }, { maxTier: 6 }],
    ["ekspert", { maxRating: 1399 }, { maxRating: 1400 }],
    ["anty-guru", { debunkFinished: 9 }, { debunkFinished: 10 }],
    ["idealny-tydzien", { perfectWeeks: 0 }, { perfectWeeks: 1 }],
  ] as [string, Partial<Facts>, Partial<Facts>][])(
    "%s: just below no, at the threshold yes",
    (id, below, at) => {
      expect(earned(below)).not.toContain(id);
      expect(earned(at)).toContain(id);
    },
  );

  it("one of each type and kind; claims; nothing twice", () => {
    const types = [
      "numeric",
      "estimation",
      "interactive",
      "symbolic",
      "choice",
      "multi",
      "ordering",
    ];
    expect(earned({ solvedTypes: types })).not.toContain("wszystkie-typy");
    expect(earned({ solvedTypes: [...types, "code"] })).toContain("wszystkie-typy");
    const kinds = ["mental_math", "market_making", "probability_sprint", "brainteasers"];
    expect(earned({ interviewKinds: kinds })).not.toContain("wszystkie-rozmowy");
    expect(earned({ interviewKinds: [...kinds, "open_modelling"] })).toContain("wszystkie-rozmowy");
    expect(earned({ claims: ["ruina-gracza"] })).toEqual(["ruina-gracza"]);
    expect(earned({ solved: 10 }, ["pierwszy-krok"])).toEqual(["dziesiatka"]);
    expect(ACHIEVEMENTS.filter((a) => a.client).map((a) => a.id)).toEqual(["ruina-gracza"]);
  });
});

describe("dashboard helpers", () => {
  it("next lesson is the first one not completed", () => {
    const order = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const done = new Map([
      ["a", "completed"],
      ["b", "in_progress"],
    ]);
    expect(nextLesson(order, (id) => done.get(id))?.id).toBe("b");
    expect(nextLesson(order, () => "mastered")).toBeNull();
  });

  it("problem of the day: same for everyone on a date, changes day to day, none when empty", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ id: `e${String(i)}` }));
    expect(pickOfDay(items, "2026-11-02")).toEqual(pickOfDay([...items].reverse(), "2026-11-02"));
    const week = Array.from(
      { length: 7 },
      (_, i) => pickOfDay(items, addDays("2026-11-02", i))?.id,
    );
    expect(new Set(week).size).toBe(7);
    expect(pickOfDay([], "2026-11-02")).toBeNull();
  });

  it("goal share is clamped", () => {
    expect(goalShare(10, 50)).toBe(0.2);
    expect(goalShare(80, 50)).toBe(1);
    expect(goalShare(5, 0)).toBe(1);
  });
});

describe("problem of the day results", () => {
  const key = dailyKey("2026-11-02", 3);

  it("records attempts until solved, then stops; keeps the most hints used", () => {
    let raw: string | null = null;
    raw = withDailyAttempt(raw, key, "e1", false, 0);
    raw = withDailyAttempt(raw, key, "e1", false, 1);
    raw = withDailyAttempt(raw, key, "e1", true, 1);
    raw = withDailyAttempt(raw, key, "e1", false, 3); // after solving: ignored
    const r = parseDaily(raw).days[key];
    expect(r).toEqual({ exerciseId: "e1", marks: ["x", "x", "o"], hints: 1 });
    expect(grid(r?.marks ?? [])).toBe("🟥🟥🟩");
    expect(solved(r)).toBe(true);
  });

  it("caps attempts and survives bad storage", () => {
    let raw: string | null = "{not json";
    for (let i = 0; i < 15; i++) raw = withDailyAttempt(raw, key, "e1", false, 0);
    expect(parseDaily(raw).days[key]?.marks).toHaveLength(MAX_ATTEMPTS);
    expect(parseDaily('{"version":2}')).toEqual({ version: 1, days: {} });
  });

  it("share parameters are strict", () => {
    expect(shareParams.safeParse({ d: "2026-11-02", l: "3", r: "xxo", h: "1" }).success).toBe(true);
    for (const bad of [
      { d: "2026-11-02", l: "6", r: "o", h: "0" },
      { d: "02.11.2026", l: "3", r: "o", h: "0" },
      { d: "2026-11-02", l: "3", r: "xox<script>", h: "0" },
      { d: "2026-11-02", l: "3", r: "", h: "0" },
      { d: "2026-11-02", l: "3", r: "o", h: "0", format: "poster" },
    ]) {
      expect(shareParams.safeParse(bad).success).toBe(false);
    }
    expect(shareParams.parse({ d: "2026-11-02", l: "3", r: "o", h: "0" })).toMatchObject({
      lang: "pl",
      format: "og",
    });
  });
});

describe("weekly challenge", () => {
  const c = (week: string, status: "draft" | "published" = "published") => ({
    id: `c-${week}`,
    week,
    status,
    deadline: `${addDays(week, 6)}T22:00:00Z`,
  });
  it("this week's published challenge, open until its deadline", () => {
    const all = [c("2026-10-26"), c("2026-11-02"), c("2026-11-09", "draft")];
    expect(currentChallenge(all, new Date("2026-11-04T12:00:00Z"))).toMatchObject({
      id: "c-2026-11-02",
      open: true,
    });
    expect(currentChallenge(all, new Date("2026-11-08T22:30:00Z"))?.open).toBe(false);
    expect(currentChallenge(all, new Date("2026-11-10T12:00:00Z"))).toBeNull(); // draft
    expect(currentChallenge([], new Date())).toBeNull();
  });
});
