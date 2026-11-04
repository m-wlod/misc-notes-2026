/**
 * Row Level Security, proven table by table.
 *
 * Every table in `public` must appear in exactly one of OWNED, PUBLIC_CATALOG, STAFF_ONLY
 * or SERVER_ONLY below; the first test fails if a new table is added without a line here.
 * For each OWNED table, user A must be able to do exactly what the policy allows with
 * their own rows and nothing at all with user B's.
 */
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, anon, createUser, deleteUser, sql, type TestUser } from "./stack";

type Who = "A" | "B" | "C";
type Ctx = { attempts: Record<Who, number>; sessions: Record<Who, string> };
type Row = Record<string, unknown>;

type OwnedTable = {
  table: string;
  owner?: string; // owner column, default user_id
  /** What the owner may do with their own rows. */
  can: { insert: boolean; update: boolean; delete: boolean };
  /** Row to seed (admin) for A and B, and to insert as C when insert is allowed. */
  row?: (uid: string, who: Who, ctx: Ctx) => Row;
  /** A harmless change used for the update tests. */
  patch: Row;
  /** Rows already created by the signup trigger, so nothing to seed. */
  createdBySignup?: boolean;
};

const OWNED: OwnedTable[] = [
  {
    table: "profiles",
    owner: "id",
    createdBySignup: true,
    can: { insert: false, update: true, delete: false },
    patch: { display_name: "hacked" },
  },
  {
    table: "entitlements",
    createdBySignup: true,
    can: { insert: false, update: false, delete: false },
    patch: { source: "hacked" },
    row: (u) => ({ user_id: u, plan: "free" }),
  },
  {
    table: "streaks",
    createdBySignup: true,
    can: { insert: false, update: false, delete: false },
    patch: { current_days: 999 },
    row: (u) => ({ user_id: u }),
  },
  {
    table: "lesson_progress",
    can: { insert: true, update: true, delete: true },
    patch: { status: "mastered" },
    row: (u) => ({ user_id: u, lesson_id: "l1" }),
  },
  {
    table: "exercise_attempts",
    can: { insert: false, update: false, delete: false },
    patch: { score: 1 },
    row: (u) => ({ user_id: u, exercise_id: "e1", answer: { v: 1 }, score: 0.5, grader: "auto" }),
  },
  {
    table: "review_cards",
    can: { insert: true, update: true, delete: true },
    patch: { reps: 99 },
    row: (u) => ({ user_id: u, card_id: "c1" }),
  },
  {
    table: "lesson_notes",
    can: { insert: true, update: true, delete: true },
    patch: { body: "hacked" },
    row: (u) => ({ user_id: u, lesson_id: "l1", body: "note" }),
  },
  {
    table: "highlights",
    can: { insert: true, update: true, delete: true },
    patch: { note: "hacked" },
    row: (u) => ({ user_id: u, lesson_id: "l1", anchor: { start: 1 } }),
  },
  {
    table: "bookmarks",
    can: { insert: true, update: true, delete: true },
    patch: { lesson_id: "l9" },
    row: (u) => ({ user_id: u, lesson_id: "l1" }),
  },
  {
    table: "notebooks",
    can: { insert: true, update: true, delete: true },
    patch: { title: "hacked" },
    row: (u) => ({ user_id: u, title: "t" }),
  },
  {
    table: "xp_events",
    can: { insert: false, update: false, delete: false },
    patch: { amount: 9999 },
    row: (u) => ({ user_id: u, amount: 10, reason: "test", idempotency_key: randomUUID() }),
  },
  {
    table: "user_achievements",
    can: { insert: false, update: false, delete: false },
    patch: { earned_at: "2000-01-01T00:00:00Z" },
    row: (u) => ({ user_id: u, achievement_id: "kelly" }),
  },
  {
    table: "league_memberships",
    can: { insert: false, update: false, delete: false },
    patch: { weekly_xp: 9999 },
    // A, B and C sit in different groups, so they must not see each other.
    row: (u, who) => ({
      user_id: u,
      league_id: 1,
      group_no: { A: 1, B: 2, C: 3 }[who],
      week_start: "2026-11-02",
    }),
  },
  {
    table: "topic_ratings",
    can: { insert: false, update: false, delete: false },
    patch: { rating: 3000 },
    row: (u) => ({ user_id: u, topic: "t" }),
  },
  {
    table: "certificates",
    can: { insert: false, update: false, delete: false },
    patch: { score: 1 },
    row: (u) => ({ user_id: u, track_id: "t" }),
  },
  {
    table: "challenge_submissions",
    can: { insert: true, update: false, delete: false },
    patch: { status: "approved" },
    row: (u) => ({ user_id: u, challenge_id: "c", body: "b" }),
  },
  {
    table: "interview_sessions",
    can: { insert: false, update: false, delete: false },
    patch: { score: 1 },
    row: (u) => ({ user_id: u, kind: "mental_math", level: 1 }),
  },
  {
    table: "interview_answers",
    can: { insert: false, update: false, delete: false },
    patch: { score: 1 },
    row: (u, who, ctx) => ({
      user_id: u,
      session_id: ctx.sessions[who],
      question_id: "q",
      answer: {},
    }),
  },
  {
    table: "comments",
    can: { insert: true, update: true, delete: true },
    patch: { body: "edited" },
    // Approved comments are public by design, so B's is hidden to test isolation.
    row: (u, who) => ({
      user_id: u,
      target_type: "lesson",
      target_id: "l1",
      body: "b",
      status: who === "B" ? "hidden" : "approved",
    }),
  },
  {
    table: "votes",
    can: { insert: true, update: true, delete: true },
    patch: { value: -1 },
    row: (u) => ({ user_id: u, target_type: "comment", target_id: 1, value: 1 }),
  },
  {
    table: "reports",
    can: { insert: true, update: false, delete: false },
    patch: { reason: "hacked" },
    row: (u) => ({ user_id: u, target_type: "comment", target_id: "1", reason: "r" }),
  },
  {
    table: "notifications",
    can: { insert: false, update: true, delete: true },
    patch: { read_at: "2026-11-01T00:00:00Z" },
    row: (u) => ({ user_id: u, kind: "k" }),
  },
  {
    table: "notification_prefs",
    can: { insert: true, update: true, delete: false },
    patch: { email_weekly: false },
    row: (u) => ({ user_id: u }),
  },
  {
    table: "push_subscriptions",
    can: { insert: true, update: false, delete: true },
    patch: { auth: "hacked" },
    row: (u) => ({
      user_id: u,
      endpoint: `https://push.example/${randomUUID()}`,
      p256dh: "k",
      auth: "a",
    }),
  },
  {
    table: "shared_solutions",
    can: { insert: true, update: false, delete: true },
    patch: { mentor_pick: true },
    row: (u) => ({ user_id: u, exercise_id: "e1", body: "b", format: "text" }),
  },
  {
    table: "content_error_reports",
    can: { insert: true, update: false, delete: false },
    patch: { body: "hacked" },
    row: (u) => ({ user_id: u, content_type: "lesson", content_id: "l1", body: "b" }),
  },
  {
    table: "debunk_submissions",
    can: { insert: true, update: false, delete: false },
    patch: { claim: "hacked" },
    row: (u) => ({ user_id: u, claim: "c" }),
  },
  {
    table: "grading_disputes",
    can: { insert: true, update: false, delete: false },
    patch: { reason: "hacked" },
    row: (u, who, ctx) => ({ user_id: u, attempt_id: ctx.attempts[who], reason: "r" }),
  },
  {
    table: "ai_grading_usage",
    can: { insert: false, update: false, delete: false },
    patch: { cost_usd: 0 },
    row: (u) => ({ user_id: u, model: "m", tokens_in: 1, tokens_out: 1, cost_usd: 0.01 }),
  },
  {
    table: "user_roles",
    can: { insert: false, update: false, delete: false },
    patch: { granted_at: "2000-01-01T00:00:00Z" },
    row: (u) => ({ user_id: u, role: "reviewer" }),
  },
];

/** Readable by everyone, writable by nobody through the API (admins only where noted). */
const PUBLIC_CATALOG: Record<string, Row> = {
  achievements: {
    id: "probe-x",
    name_pl: "x",
    name_en: "x",
    description_pl: "x",
    description_en: "x",
  },
  leagues: { id: 99, slug: "probe", name_pl: "x", name_en: "x", tier: 99 },
  daily_problems: { day: "2026-01-01", level: 1, exercise_id: "e" },
  exercise_stats: { exercise_id: "probe" },
  feature_flags: { key: "probe", enabled: true },
  announcements: { body_pl: "x", body_en: "x" },
};
/** Readable by staff or admins only, written only by server code (Phases 17–18). */
const STAFF_ONLY = ["audit_log", "bans", "app_settings", "cron_runs", "utm_visits"];
/** RLS on and no policies at all: deny everything to anon and authenticated. */
const SERVER_ONLY = ["newsletter_subscribers", "newsletter_sends"];

const RLS_DENIED = "42501";

let A: TestUser, B: TestUser, C: TestUser;
const ctx: Ctx = { attempts: { A: 0, B: 0, C: 0 }, sessions: { A: "", B: "", C: "" } };

const untyped = (c: TestUser["client"]) => c as unknown as SupabaseClient;
const ownerOf = (t: OwnedTable) => t.owner ?? "user_id";

async function adminRows(t: OwnedTable, uid: string): Promise<Row[]> {
  const { data, error } = await untyped(admin()).from(t.table).select("*").eq(ownerOf(t), uid);
  if (error) throw error;
  return data as Row[];
}

beforeAll(async () => {
  [A, B, C] = await Promise.all([createUser("a"), createUser("b"), createUser("c")]);
  const db = admin();
  for (const [who, u] of [
    ["A", A],
    ["B", B],
    ["C", C],
  ] as const) {
    const attempt = await db
      .from("exercise_attempts")
      .insert({ user_id: u.id, exercise_id: "parent", answer: {}, score: 0, grader: "auto" })
      .select("id")
      .single();
    if (attempt.error) throw attempt.error;
    ctx.attempts[who] = attempt.data.id;
    const session = await db
      .from("interview_sessions")
      .insert({ user_id: u.id, kind: "brainteasers", level: 1 })
      .select("id")
      .single();
    if (session.error) throw session.error;
    ctx.sessions[who] = session.data.id;
  }
  // Sharing a solution needs the exercise solved (the spoiler gate, Phase 17).
  const solved = await db
    .from("exercise_attempts")
    .insert({ user_id: C.id, exercise_id: "e1", answer: {}, score: 1, grader: "auto" });
  if (solved.error) throw solved.error;
  // Seed A's and B's rows with the secret key (bypasses RLS).
  for (const t of OWNED) {
    if (t.createdBySignup || !t.row) continue;
    for (const [who, u] of [
      ["A", A],
      ["B", B],
    ] as const) {
      const { error } = await untyped(db)
        .from(t.table)
        .insert(t.row(u.id, who, ctx));
      if (error) throw new Error(`seed ${t.table}: ${error.message}`);
    }
  }
});

afterAll(async () => {
  await Promise.all([deleteUser(A), deleteUser(B), deleteUser(C)]);
});

describe("schema", () => {
  it("every public table has RLS enabled, a policy (or is server-only) and a test category", async () => {
    const db = sql();
    try {
      const tables = await db<{ name: string; rls: boolean; policies: number }[]>`
        select c.relname as name, c.relrowsecurity as rls,
               (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by 1`;
      const categorised = new Set([
        ...OWNED.map((t) => t.table),
        ...Object.keys(PUBLIC_CATALOG),
        ...STAFF_ONLY,
        ...SERVER_ONLY,
      ]);

      expect(
        tables.filter((t) => !t.rls).map((t) => t.name),
        "tables without RLS",
      ).toEqual([]);
      expect(
        tables.filter((t) => t.policies === 0 && !SERVER_ONLY.includes(t.name)).map((t) => t.name),
        "tables without any policy",
      ).toEqual([]);
      expect(
        tables.filter((t) => !categorised.has(t.name)).map((t) => t.name),
        "tables missing from rls.test.ts",
      ).toEqual([]);
      // …and no stale test lines for tables that no longer exist.
      expect([...categorised].sort()).toEqual(tables.map((t) => t.name));
    } finally {
      await db.end();
    }
  });
});

describe.each(OWNED)("$table", (t) => {
  const owner = ownerOf(t);

  it("A reads own rows and none of B's", async () => {
    const { data, error } = await untyped(A.client).from(t.table).select("*");
    expect(error).toBeNull();
    const rows = data as Row[];
    expect(rows.length, "A sees own rows").toBeGreaterThan(0);
    expect(
      rows.filter((r) => r[owner] === B.id),
      "A sees B's rows",
    ).toEqual([]);
  });

  it("A cannot update or delete B's rows", async () => {
    const before = await adminRows(t, B.id);
    expect(before.length).toBeGreaterThan(0);

    const upd = await untyped(A.client).from(t.table).update(t.patch).eq(owner, B.id).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await untyped(A.client).from(t.table).delete().eq(owner, B.id).select();
    expect(del.data ?? []).toEqual([]);

    expect(await adminRows(t, B.id)).toEqual(before);
  });

  it("A cannot insert a row owned by B", async () => {
    if (!t.row) return; // profiles: no insert policy at all, covered by the C test below
    const { error } = await untyped(A.client)
      .from(t.table)
      .insert(t.row(B.id, "C", ctx));
    expect(error?.code).toBe(RLS_DENIED);
  });

  it(`own update is ${t.can.update ? "allowed" : "denied"}`, async () => {
    const res = await untyped(A.client).from(t.table).update(t.patch).eq(owner, A.id).select();
    expect(res.error).toBeNull();
    expect((res.data ?? []).length > 0).toBe(t.can.update);
  });

  it(`own insert is ${t.can.insert ? "allowed" : "denied"}`, async () => {
    const row = t.row ? t.row(C.id, "C", ctx) : { [owner]: C.id };
    const { error } = await untyped(C.client).from(t.table).insert(row);
    if (t.can.insert) expect(error).toBeNull();
    else expect(error?.code).toBe(RLS_DENIED);
  });

  it(`own delete is ${t.can.delete ? "allowed" : "denied"}`, async () => {
    const before = await adminRows(t, A.id);
    const res = await untyped(A.client).from(t.table).delete().eq(owner, A.id).select();
    expect(res.error).toBeNull();
    expect((res.data ?? []).length > 0).toBe(t.can.delete);
    if (!t.can.delete) expect(await adminRows(t, A.id)).toEqual(before);
  });
});

describe("anonymous visitors", () => {
  it("read nothing from user-owned tables (except approved comments)", async () => {
    for (const t of OWNED) {
      const { data } = await untyped(anon()).from(t.table).select("*");
      const rows = (data ?? []) as Row[];
      if (t.table === "comments") {
        expect(
          rows.every((r) => r.status === "approved"),
          "anon sees only approved comments",
        ).toBe(true);
      } else {
        expect(rows, `anon read ${t.table}`).toEqual([]);
      }
    }
  });

  it("read the public catalog but cannot write it", async () => {
    for (const [table, probe] of Object.entries(PUBLIC_CATALOG)) {
      const read = await untyped(anon()).from(table).select("*").limit(1);
      expect(read.error, `anon read ${table}`).toBeNull();
      const write = await untyped(anon()).from(table).insert(probe);
      expect(write.error?.code, `anon write ${table}`).toBe(RLS_DENIED);
      const userWrite = await untyped(A.client).from(table).insert(probe);
      expect(userWrite.error?.code, `user write ${table}`).toBe(RLS_DENIED);
    }
  });

  it("cannot touch server-only and staff-only tables", async () => {
    await admin().from("audit_log").insert({ action: "probe", actor_id: A.id });
    const { data: run } = await admin()
      .from("cron_runs")
      .insert({ job: "notify" })
      .select("id")
      .single();
    await admin()
      .from("app_settings")
      .upsert({ key: "ai", value: { dailyBudgetUsd: 1 } });
    for (const table of [...SERVER_ONLY, ...STAFF_ONLY]) {
      for (const client of [anon(), A.client]) {
        const { data } = await untyped(client).from(table).select("*");
        expect(data ?? [], `read ${table}`).toEqual([]);
      }
    }
    for (const [table, row] of [
      ["app_settings", { key: "ai", value: { dailyBudgetUsd: 1000 } }],
      ["cron_runs", { job: "notify" }],
    ] as const) {
      const { error: writeError } = await untyped(A.client).from(table).insert(row);
      expect(writeError?.code, `write ${table}`).toBe(RLS_DENIED);
    }
    await admin()
      .from("cron_runs")
      .delete()
      .eq("id", run?.id ?? 0);
    await admin().from("app_settings").delete().eq("key", "ai");
    const { error } = await untyped(anon())
      .from("newsletter_subscribers")
      .insert({ email: "x@test.local" });
    expect(error?.code).toBe(RLS_DENIED);
  });
});

describe("public profiles view", () => {
  it("shows only opted-in users and only safe columns", async () => {
    await admin()
      .from("profiles")
      .update({ is_public: true, display_name: "Publiczny" })
      .eq("id", B.id);
    const { data, error } = await anon().from("public_profiles").select("*");
    expect(error).toBeNull();
    const ids = (data ?? []).map((p) => p.id);
    expect(ids).toContain(B.id);
    expect(ids).not.toContain(A.id);
    const b = (data ?? []).find((p) => p.id === B.id) as Row;
    expect(Object.keys(b).sort()).toEqual([
      "avatar_url",
      "created_at",
      "display_name",
      "handle",
      "id",
      "placement_level",
    ]);
  });
});

describe("policies (Phase 21 audit)", () => {
  it("no policy lets anonymous visitors write anything", async () => {
    const db = sql();
    try {
      const rows = await db<{ tablename: string; policyname: string }[]>`
        select tablename, policyname from pg_policies
         where schemaname = 'public' and 'anon' = any(roles) and cmd <> 'SELECT'`;
      expect(rows).toEqual([]);
    } finally {
      await db.end();
    }
  });

  it("no policy lets staff write directly: staff changes go through audited server code", async () => {
    const db = sql();
    try {
      const rows = await db<{ tablename: string; policyname: string }[]>`
        select tablename, policyname from pg_policies
         where schemaname = 'public' and cmd <> 'SELECT'
           and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(is_staff|has_role)'`;
      expect(rows).toEqual([]);
    } finally {
      await db.end();
    }
  });
});

describe("staff", () => {
  it("a moderator can't publish an announcement or edit someone's comment directly", async () => {
    const mod = await createUser("mod2");
    try {
      await admin().from("user_roles").insert({ user_id: mod.id, role: "moderator" });
      const ann = await mod.client
        .from("announcements")
        .insert({ body_pl: "x", body_en: "x" })
        .select();
      expect(ann.data ?? []).toEqual([]);
      const edit = await mod.client
        .from("comments")
        .update({ status: "hidden" })
        .eq("user_id", B.id)
        .select();
      expect(edit.data ?? []).toEqual([]);
    } finally {
      await deleteUser(mod);
    }
  });

  it("nobody resolves reports directly, not even a moderator (only the audited app path)", async () => {
    const mod = await createUser("mod");
    try {
      await admin().from("user_roles").insert({ user_id: mod.id, role: "moderator" });
      const asUser = await A.client
        .from("reports")
        .update({ status: "approved" })
        .eq("user_id", B.id)
        .select();
      expect(asUser.data ?? []).toEqual([]);
      const asMod = await mod.client
        .from("reports")
        .update({ status: "approved" })
        .eq("user_id", B.id)
        .select();
      expect(asMod.data ?? []).toEqual([]);
      // Staff still read the queue.
      const read = await mod.client.from("reports").select("id").eq("user_id", B.id);
      expect((read.data ?? []).length).toBeGreaterThan(0);
    } finally {
      await deleteUser(mod);
    }
  });
});
