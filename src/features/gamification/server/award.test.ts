import { describe, expect, it } from "vitest";

import { encodeRef } from "../facts";
import { exerciseXp, goalXp, xpKey } from "../xp";
import { award, claim, rateAttempt, type AwardEvent } from "./award";
import { memoryStore } from "./memory-store";
import { rollFinishedWeeks } from "./roll";

const lookups = { topicsOf: () => [] as string[], modulesCompleted: () => 0 };
const profile = { timeZone: "Europe/Warsaw", dailyGoalMinutes: 5, leagueOptOut: false };
const solve = (id: string, level = 3, firstTry = true): AwardEvent => ({
  reason: "exercise",
  amount: exerciseXp({ level, hintsUsed: 0, firstTry, correct: true }),
  key: xpKey.exercise(id),
  ref: encodeRef({ id, l: level, t: "numeric", h: 0, f: firstTry }),
});
const at = (iso: string) => new Date(iso);

describe("award", () => {
  it("awards once per key; a repeat changes nothing", async () => {
    const { store, xp } = memoryStore({ a: profile });
    const first = await award(
      store,
      "a",
      solve("e1", 1, false),
      lookups,
      at("2026-11-02T10:00:00Z"),
    );
    expect(first).toMatchObject({ xp: 10, goalMet: false, streak: 0 });
    expect(
      await award(store, "a", solve("e1", 1, false), lookups, at("2026-11-02T11:00:00Z")),
    ).toBeNull();
    expect(xp).toHaveLength(1);
    expect(xp[0]?.key).toBe("a:exercise:e1");
  });

  it("nobody without a profile (signed-out or unknown) gets anything", async () => {
    const { store, xp } = memoryStore({});
    expect(await award(store, "ghost", solve("e1"), lookups)).toBeNull();
    expect(xp).toHaveLength(0);
  });

  it("the daily goal is awarded once, on the learner's local day, and starts the streak", async () => {
    const { store, xp, streaks } = memoryStore({ a: profile });
    expect(goalXp(5)).toBe(25);
    // 45 XP at 23:30 Warsaw on the 2nd (22:30 UTC): the goal (25) for the 2nd.
    const r = await award(store, "a", solve("e1"), lookups, at("2026-11-02T22:30:00Z"));
    expect(r).toMatchObject({ goalMet: true, streak: 1, xp: 45 + 20 });
    expect(xp.find((x) => x.reason === "daily_goal")?.ref).toBe("day=2026-11-02");
    // Another solve the same local day: no second goal.
    const r2 = await award(store, "a", solve("e2"), lookups, at("2026-11-02T22:45:00Z"));
    expect(r2).toMatchObject({ goalMet: false, streak: 1 });
    // 00:10 Warsaw on the 3rd (23:10 UTC on the 2nd): a new local day, a new goal.
    const r3 = await award(store, "a", solve("e3"), lookups, at("2026-11-02T23:10:00Z"));
    expect(r3).toMatchObject({ goalMet: true, streak: 2 });
    expect(streaks.get("a")?.current).toBe(2);
  });

  it("a doubled goal the day after a miss repairs the streak, once", async () => {
    const { store } = memoryStore({ a: profile });
    for (const [i, day] of ["01", "02", "03"].entries()) {
      await award(store, "a", solve(`d${String(i)}`), lookups, at(`2026-11-${day}T10:00:00Z`));
    }
    // The 4th is missed. On the 5th, one solve (45 ≥ 25) meets the goal but not 2× (50).
    const one = await award(store, "a", solve("r1"), lookups, at("2026-11-05T09:00:00Z"));
    expect(one).toMatchObject({ goalMet: true, repaired: false, streak: 1 });
    // A second solve: 90 ≥ 50, the streak is repaired: 3 + 1.
    const two = await award(store, "a", solve("r2"), lookups, at("2026-11-05T10:00:00Z"));
    expect(two).toMatchObject({ repaired: true, streak: 4 });
    const three = await award(store, "a", solve("r3"), lookups, at("2026-11-05T11:00:00Z"));
    expect(three).toMatchObject({ repaired: false, streak: 4 });
  });

  it("joins this week's league (unless opted out) and keeps the weekly XP current", async () => {
    const { store, members } = memoryStore({ a: profile, b: { ...profile, leagueOptOut: true } });
    await award(store, "a", solve("e1"), lookups, at("2026-11-03T10:00:00Z"));
    await award(store, "a", solve("e2"), lookups, at("2026-11-04T10:00:00Z"));
    await award(store, "b", solve("e1"), lookups, at("2026-11-03T10:00:00Z"));
    expect(members).toHaveLength(1);
    // 45 + 20 (goal) on each day.
    expect(members[0]).toMatchObject({
      userId: "a",
      week: "2026-11-02",
      tier: 1,
      group: 1,
      weeklyXp: 130,
    });
  });

  it("achievements are granted once; browser claims only for claimable ones", async () => {
    const { store, achievements } = memoryStore({ a: profile });
    const r = await award(store, "a", solve("e1"), lookups, at("2026-11-02T10:00:00Z"));
    expect(r?.achievements).toEqual(expect.arrayContaining(["pierwszy-krok"]));
    const r2 = await award(store, "a", solve("e2"), lookups, at("2026-11-02T11:00:00Z"));
    expect(r2?.achievements).not.toContain("pierwszy-krok");
    expect(await claim(store, "a", "ruina-gracza")).toBe(true);
    expect(await claim(store, "a", "ruina-gracza")).toBe(false);
    expect(await claim(store, "a", "setka")).toBe(false); // not claimable from the browser
    expect([...(achievements.get("a") ?? [])]).toContain("ruina-gracza");
  });

  it("ratings move per topic with every graded attempt", async () => {
    const { store, ratings } = memoryStore({ a: profile });
    await rateAttempt(store, "a", { topics: ["prob"], level: 1, score: 1 });
    await rateAttempt(store, "a", { topics: ["prob", "stats"], level: 1, score: 0 });
    const r = ratings.get("a");
    expect(r?.get("prob")).toBeCloseTo(1016 + (0 - 1 / (1 + 10 ** ((1000 - 1016) / 400))) * 32);
    expect(r?.get("stats")).toBeCloseTo(984);
  });
});

describe("browser-supplied ids", () => {
  it("interview sessions give XP at most N times a local day", async () => {
    const { store } = memoryStore({ a: profile });
    const session = (n: number): AwardEvent => ({
      reason: "interview",
      amount: 30,
      key: xpKey.interview(`s${String(n)}`),
      ref: encodeRef({ kind: "mental_math" }),
      dailyCap: 2,
    });
    expect(await award(store, "a", session(1), lookups, at("2026-11-02T10:00:00Z"))).not.toBeNull();
    expect(await award(store, "a", session(2), lookups, at("2026-11-02T11:00:00Z"))).not.toBeNull();
    expect(await award(store, "a", session(3), lookups, at("2026-11-02T12:00:00Z"))).toBeNull();
    // The next local day (00:30 Warsaw = 23:30 UTC) starts a new count.
    expect(await award(store, "a", session(4), lookups, at("2026-11-02T23:30:00Z"))).not.toBeNull();
  });
});

describe("weekly roll", () => {
  it("closes finished weeks once, creates next week's rows, and a returner keeps their tier", async () => {
    const people = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`u${String(i).padStart(2, "0")}`, profile]),
    );
    const { store, members } = memoryStore(people);
    // Week of 2026-11-02: 10 of 12 learners active.
    for (const [i, id] of Object.keys(people).entries()) {
      if (i >= 10) continue;
      for (let k = 0; k <= i; k++) {
        await award(
          store,
          id,
          solve(`${id}-${String(k)}`, 1, false),
          lookups,
          at("2026-11-04T10:00:00Z"),
        );
      }
    }
    expect(await rollFinishedWeeks(store, at("2026-11-05T10:00:00Z"))).toEqual([]); // not finished
    const rolled = await rollFinishedWeeks(store, at("2026-11-10T01:00:00Z"));
    expect(rolled).toEqual([{ week: "2026-11-02", mode: "shared", members: 10, next: 10 }]);
    const closed = members.filter((m) => m.week === "2026-11-02");
    expect(closed.map((m) => m.finalRank).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
    expect(closed.find((m) => m.userId === "u09")?.finalRank).toBe(1); // most XP
    expect(members.filter((m) => m.week === "2026-11-09")).toHaveLength(10);
    // Running again does nothing.
    expect(await rollFinishedWeeks(store, at("2026-11-10T02:00:00Z"))).toEqual([]);
    // Someone inactive for weeks returns: joins this week in tier 1 (shared mode).
    await award(store, "u11", solve("late"), lookups, at("2026-11-25T10:00:00Z"));
    expect(members.find((m) => m.userId === "u11")).toMatchObject({ week: "2026-11-23", tier: 1 });
  });
});
