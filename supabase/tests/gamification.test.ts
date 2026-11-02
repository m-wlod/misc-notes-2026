/**
 * Gamification against the real database (Phase 14): the Supabase store awards once per
 * key, keeps the streak and league rows, rolls a week, and RLS keeps learners to their
 * own XP and their own league group.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { award } = await import("../../src/features/gamification/server/award");
const { rollFinishedWeeks } = await import("../../src/features/gamification/server/roll");
const { supabaseStore } = await import("../../src/features/gamification/server/supabase-store");
const { encodeRef } = await import("../../src/features/gamification/facts");
const { leagueWeek } = await import("../../src/features/gamification/days");

import { admin, createUser, deleteUser, type TestUser } from "./stack";

const lookups = { topicsOf: () => [] as string[], modulesCompleted: () => 0 };
const store = () => supabaseStore(admin());
const solve = (id: string) => ({
  reason: "exercise" as const,
  amount: 75,
  key: `exercise:${id}`,
  ref: encodeRef({ id, l: 5, t: "numeric", h: 0, f: true }),
});

let A: TestUser | undefined;
let B: TestUser | undefined;

beforeAll(async () => {
  A = await createUser("gam-a");
  B = await createUser("gam-b");
});
afterAll(async () => {
  await deleteUser(A);
  await deleteUser(B);
});

describe("awards on the database", () => {
  it("awards once per key, meets the goal, keeps the streak and this week's league row", async () => {
    const a = A as TestUser;
    const now = new Date();
    const first = await award(store(), a.id, solve("db-e1"), lookups, now);
    // Default goal: 10 minutes = 50 XP; 75 XP meets it (+20).
    expect(first).toMatchObject({ xp: 95, goalMet: true, streak: 1 });
    expect(first?.achievements).toContain("pierwszy-krok");
    expect(await award(store(), a.id, solve("db-e1"), lookups, now)).toBeNull();

    const { data: xp } = await admin()
      .from("xp_events")
      .select("reason, amount")
      .eq("user_id", a.id);
    expect(xp?.map((r) => r.reason).sort()).toEqual(["daily_goal", "exercise"]);

    const { data: streak } = await admin()
      .from("streaks")
      .select("current_days, longest_days")
      .eq("user_id", a.id)
      .single();
    expect(streak).toMatchObject({ current_days: 1, longest_days: 1 });

    const { data: member } = await admin()
      .from("league_memberships")
      .select("league_id, group_no, weekly_xp")
      .eq("user_id", a.id)
      .eq("week_start", leagueWeek(now))
      .single();
    expect(member).toMatchObject({ league_id: 1, group_no: 1, weekly_xp: 95 });

    const { data: owned } = await admin()
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", a.id);
    expect(owned?.map((r) => r.achievement_id)).toContain("pierwszy-krok");
  });

  it("RLS: a learner reads their own XP only", async () => {
    const b = B as TestUser;
    const { data } = await b.client.from("xp_events").select("user_id");
    expect((data ?? []).every((r) => r.user_id === b.id)).toBe(true);
    const { error } = await b.client
      .from("xp_events")
      .insert({ user_id: b.id, amount: 1000, reason: "exercise", idempotency_key: "forged" });
    expect(error).not.toBeNull();
  });
});

describe("league roll on the database", () => {
  const week = "2020-01-06"; // a Monday long past, so nothing else touches it

  it("closes a past week, opens the next, and members only see their own group", async () => {
    const a = A as TestUser;
    const b = B as TestUser;
    const db = admin();
    await db.from("league_memberships").insert([
      { user_id: a.id, week_start: week, league_id: 1, group_no: 1, weekly_xp: 300 },
      { user_id: b.id, week_start: week, league_id: 1, group_no: 2, weekly_xp: 100 },
    ]);
    // Different groups: B can't see A's row.
    const { data: seen } = await b.client
      .from("league_memberships")
      .select("user_id")
      .eq("week_start", week);
    expect(seen?.map((r) => r.user_id)).toEqual([b.id]);

    const rolled = await rollFinishedWeeks(store());
    expect(rolled.find((r) => r.week === week)).toMatchObject({ mode: "shared", next: 2 });
    const { data: closed } = await db
      .from("league_memberships")
      .select("user_id, final_rank")
      .eq("week_start", week);
    expect(closed?.every((r) => r.final_rank === 1)).toBe(true); // each led their group

    // Next week: shared mode puts the tier in one group, so now they see each other.
    const { data: next } = await db
      .from("league_memberships")
      .select("user_id, league_id, group_no")
      .eq("week_start", "2020-01-13");
    expect(next?.length).toBe(2);
    expect(new Set(next?.map((r) => r.group_no))).toEqual(new Set([1]));
    const { data: together } = await b.client
      .from("league_memberships")
      .select("user_id")
      .eq("week_start", "2020-01-13");
    expect(new Set(together?.map((r) => r.user_id))).toEqual(new Set([a.id, b.id]));

    // A second roll leaves the closed week alone.
    const again = await rollFinishedWeeks(store());
    expect(again.find((r) => r.week === week)).toBeUndefined();
  });
});
