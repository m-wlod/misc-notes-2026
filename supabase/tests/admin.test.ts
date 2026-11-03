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
