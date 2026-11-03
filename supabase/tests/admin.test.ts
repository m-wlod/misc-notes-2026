/**
 * Admin panel functions (Phase 18) on the real database: only admins can call them,
 * and the dashboard numbers match a hand count over seeded rows ("dashboard numbers
 * match a SQL spot check"). The seeds sit in January 2020 so nothing else in the test
 * database falls in the checked days.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, anon, createUser, deleteUser, sql, type TestUser } from "./stack";

let boss: TestUser | undefined;
let mod: TestUser | undefined;
let u1: TestUser | undefined;
let u2: TestUser | undefined;
let u3: TestUser | undefined;

const at = (day: string) => `${day}T12:00:00Z`;

beforeAll(async () => {
  boss = await createUser("admin-boss");
  mod = await createUser("admin-mod");
  u1 = await createUser("admin-u1");
  u2 = await createUser("admin-u2");
  u3 = await createUser("admin-u3");
  const db = admin();
  await db.from("user_roles").insert([
    { user_id: boss.id, role: "admin" },
    { user_id: mod.id, role: "moderator" },
  ]);
  const pg = sql();
  try {
    for (const [u, day] of [
      [u1, "2020-01-06"],
      [u2, "2020-01-07"],
      [u3, "2020-01-13"],
    ] as const) {
      await pg`update auth.users set created_at = ${at(day)} where id = ${u.id}`;
    }
  } finally {
    await pg.end();
  }
  const attempt = (u: TestUser, day: string) => ({
    user_id: u.id,
    exercise_id: "admin-spot",
    answer: {},
    score: 1,
    grader: "auto" as const,
    created_at: at(day),
  });
  const seeded = await Promise.all([
    db
      .from("exercise_attempts")
      .insert([
        attempt(u1, "2020-01-06"),
        attempt(u1, "2020-01-06"),
        attempt(u1, "2020-01-08"),
        attempt(u2, "2020-01-15"),
      ]),
    db.from("lesson_progress").insert([
      {
        user_id: u1.id,
        lesson_id: "admin-spot",
        status: "completed",
        completed_at: at("2020-01-08"),
      },
      // Debunk reads count as activity, not as lessons.
      {
        user_id: u1.id,
        lesson_id: "debunk:x",
        status: "completed",
        completed_at: at("2020-01-08"),
      },
    ]),
    db.from("xp_events").insert([
      {
        user_id: u1.id,
        amount: 5,
        reason: "solve",
        idempotency_key: `${u1.id}:spot1`,
        created_at: at("2020-01-14"),
      },
      {
        user_id: u2.id,
        amount: 5,
        reason: "solve",
        idempotency_key: `${u2.id}:spot2`,
        created_at: at("2020-01-07"),
      },
    ]),
  ]);
  for (const r of seeded) if (r.error) throw r.error;
});

afterAll(async () => {
  for (const u of [boss, mod, u1, u2, u3]) await deleteUser(u);
});

describe("admin functions refuse everyone but admins", () => {
  const calls = (c: ReturnType<typeof anon>, target: string) => [
    c.rpc("admin_metrics", { from_day: "2020-01-06", to_day: "2020-01-07" }),
    c.rpc("admin_retention", { weeks: 2 }),
    c.rpc("admin_find_users", { q: "" }),
    c.rpc("admin_export_user", { target }),
  ];
  it("anonymous, learner and moderator get errors and no data", async () => {
    for (const client of [anon(), (u1 as TestUser).client, (mod as TestUser).client]) {
      for (const r of await Promise.all(calls(client, (u2 as TestUser).id))) {
        expect(r.error).not.toBeNull();
        expect(r.data).toBeNull();
      }
    }
  });
  it("an admin gets data", async () => {
    for (const r of await Promise.all(calls((boss as TestUser).client, (u1 as TestUser).id))) {
      expect(r.error).toBeNull();
    }
  });
});

describe("dashboard spot check", () => {
  it("daily active, WAU, sign-ups, lessons and attempts match the hand count", async () => {
    const { data, error } = await (boss as TestUser).client.rpc("admin_metrics", {
      from_day: "2020-01-06",
      to_day: "2020-01-15",
    });
    expect(error).toBeNull();
    const row = (d: string) => data?.find((r) => r.day === d);
    // [active, wau, signups, lessons, attempts]
    const expected: Record<string, [number, number, number, number, number]> = {
      "2020-01-06": [1, 1, 1, 0, 2],
      "2020-01-07": [1, 2, 1, 0, 0],
      "2020-01-08": [1, 2, 0, 1, 1],
      "2020-01-12": [0, 2, 0, 0, 0],
      "2020-01-13": [0, 2, 1, 0, 0],
      "2020-01-14": [1, 1, 0, 0, 0],
      "2020-01-15": [1, 2, 0, 0, 1],
    };
    expect(data).toHaveLength(10);
    for (const [day, [a, w, s, l, t]] of Object.entries(expected)) {
      expect(row(day), day).toEqual({
        day,
        active_users: a,
        wau: w,
        signups: s,
        lessons_completed: l,
        attempts: t,
      });
    }
  });

  it("the same numbers straight from the tables", async () => {
    const pg = sql();
    try {
      const [direct] = await pg<{ attempts: number; signups: number }[]>`
        select
          (select count(*)::int from public.exercise_attempts
            where created_at >= '2020-01-06' and created_at < '2020-01-16') as attempts,
          (select count(*)::int from auth.users
            where created_at >= '2020-01-06' and created_at < '2020-01-16') as signups`;
      const { data } = await (boss as TestUser).client.rpc("admin_metrics", {
        from_day: "2020-01-06",
        to_day: "2020-01-15",
      });
      expect(data?.reduce((s, r) => s + r.attempts, 0)).toBe(direct?.attempts);
      expect(data?.reduce((s, r) => s + r.signups, 0)).toBe(direct?.signups);
    } finally {
      await pg.end();
    }
  });

  it("weekly retention cohorts", async () => {
    const { data, error } = await (boss as TestUser).client.rpc("admin_retention", { weeks: 400 });
    expect(error).toBeNull();
    const cohort = (c: string) =>
      (data ?? [])
        .filter((r) => r.cohort === c && r.week <= 2)
        .map((r) => [r.size, r.week, r.active]);
    expect(cohort("2020-01-06")).toEqual([
      [2, 0, 2],
      [2, 1, 2],
      [2, 2, 0],
    ]);
    expect(cohort("2020-01-13")).toEqual([
      [1, 0, 0],
      [1, 1, 0],
      [1, 2, 0],
    ]);
  });
});

describe("users", () => {
  it("search finds by handle and by id, with roles and bans", async () => {
    const b = boss as TestUser;
    const { data: byId } = await b.client.rpc("admin_find_users", { q: (mod as TestUser).id });
    expect(byId?.map((u) => [u.id, u.roles, u.banned])).toEqual([
      [(mod as TestUser).id, "moderator", false],
    ]);
    const { data: byEmail } = await b.client.rpc("admin_find_users", { q: (u1 as TestUser).email });
    expect(byEmail?.map((u) => u.id)).toEqual([(u1 as TestUser).id]);
  });

  it("the admin export has exactly the keys of the user's own export", async () => {
    const { data: own } = await (u1 as TestUser).client.rpc("export_my_data");
    const { data: forAdmin } = await (boss as TestUser).client.rpc("admin_export_user", {
      target: (u1 as TestUser).id,
    });
    const keys = (v: unknown) => Object.keys(v as object).sort();
    expect(keys(forAdmin)).toEqual(keys(own));
    expect((forAdmin as { exercise_attempts: unknown[] }).exercise_attempts).toHaveLength(3);
  });

  it("users can't grant themselves roles", async () => {
    const u = u1 as TestUser;
    const { error } = await u.client.from("user_roles").insert({ user_id: u.id, role: "admin" });
    expect(error).not.toBeNull();
  });
});

describe("exercise analytics (Phase 18b)", () => {
  let reviewer: TestUser | undefined;
  const EX = "admin-analytics";

  beforeAll(async () => {
    reviewer = await createUser("admin-reviewer");
    const db = admin();
    await db.from("user_roles").insert({ user_id: reviewer.id, role: "reviewer" });
    const row = (
      u: TestUser,
      answer: Record<string, string | boolean>,
      score: number,
      time: number | null,
      hints: number,
    ) => ({
      user_id: u.id,
      exercise_id: EX,
      answer,
      score,
      grader: "auto" as const,
      time_ms: time,
      hints_used: hints,
    });
    const { error } = await db
      .from("exercise_attempts")
      .insert([
        row(u1 as TestUser, { kind: "text", value: "6" }, 1, 10_000, 0),
        row(u1 as TestUser, { kind: "text", value: " 5 " }, 0, 20_000, 1),
        row(u2 as TestUser, { kind: "text", value: "5" }, 0, 30_000, 2),
        row(u2 as TestUser, { kind: "text", value: "5" }, 0, null, 0),
        row(u3 as TestUser, { kind: "text", value: "Dwa  Razy" }, 0, 40_000, 0),
        row(u3 as TestUser, { revealed: true }, 0, null, 0),
      ]);
    if (error) throw error;
  });

  afterAll(async () => {
    await deleteUser(reviewer);
  });

  it("is refused to anonymous visitors and learners, open to all staff", async () => {
    for (const c of [anon(), (u1 as TestUser).client]) {
      const r = await c.rpc("admin_exercise_analytics", { ex: EX });
      expect(r.error).not.toBeNull();
      expect(r.data).toBeNull();
    }
    for (const u of [boss, mod, reviewer]) {
      const r = await (u as TestUser).client.rpc("admin_exercise_analytics", { ex: EX });
      expect(r.error).toBeNull();
    }
  });

  it("matches a hand count: success rate, median time, hints and normalised wrong answers", async () => {
    const { data } = await (reviewer as TestUser).client.rpc("admin_exercise_analytics", {
      ex: EX,
    });
    expect(data).toEqual({
      attempts: 6,
      users: 3,
      success_rate: 0.1667,
      // Timed attempts: 10, 20, 30, 40 s; the lower median (percentile_disc).
      median_time_ms: 20_000,
      mean_hints: 0.5,
      wrong: [
        { answer: { kind: "text", value: "5" }, count: 3 },
        { answer: { kind: "text", value: "dwa razy" }, count: 1 },
      ],
    });
  });

  it("an exercise nobody tried has zero attempts and no rates", async () => {
    const { data } = await (boss as TestUser).client.rpc("admin_exercise_analytics", {
      ex: "nobody-tried-this",
    });
    expect(data).toEqual({
      attempts: 0,
      users: 0,
      success_rate: null,
      median_time_ms: null,
      mean_hints: null,
      wrong: [],
    });
  });
});

describe("grading disputes (Phase 18b)", () => {
  it("a learner disputes their own attempt, never someone else's, and can't resolve it", async () => {
    const db = admin();
    const { data: own } = await db
      .from("exercise_attempts")
      .select("id")
      .eq("user_id", (u1 as TestUser).id)
      .limit(1)
      .single();
    const { data: other } = await db
      .from("exercise_attempts")
      .select("id")
      .eq("user_id", (u2 as TestUser).id)
      .limit(1)
      .single();
    const c = (u1 as TestUser).client;
    const mine = await c
      .from("grading_disputes")
      .insert({ user_id: (u1 as TestUser).id, attempt_id: own?.id ?? 0, reason: "Za nisko" })
      .select("id")
      .single();
    expect(mine.error).toBeNull();
    const theirs = await c
      .from("grading_disputes")
      .insert({ user_id: (u1 as TestUser).id, attempt_id: other?.id ?? 0, reason: "x" });
    expect(theirs.error).not.toBeNull();
    const resolved = await c
      .from("grading_disputes")
      .update({ status: "approved" })
      .eq("id", mine.data?.id ?? 0)
      .select("id");
    expect(resolved.data ?? []).toEqual([]);
    const { data: after } = await db
      .from("grading_disputes")
      .select("status")
      .eq("id", mine.data?.id ?? 0)
      .single();
    expect(after?.status).toBe("pending");
  });
});
