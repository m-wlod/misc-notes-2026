import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, anon, createUser, deleteUser, sql, type TestUser } from "./stack";

/**
 * Phase 21b (RODO): the data export covers every table that holds a user's data,
 * deleting an account leaves nothing behind (posts stay anonymised), and the retention
 * job removes exactly what the privacy policy says, when it says.
 */
let A: TestUser;

beforeAll(async () => {
  A = await createUser("privacy");
});
afterAll(async () => {
  await deleteUser(A);
});

/** Tables with a `user_id` column: everything that belongs to a user. */
async function userTables(): Promise<string[]> {
  const db = sql();
  try {
    const rows = await db<{ table_name: string }[]>`
      select c.table_name from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'user_id'
         and t.table_type = 'BASE TABLE'
       order by 1`;
    return rows.map((r) => r.table_name);
  } finally {
    await db.end();
  }
}

/** Export keys that differ from their table's name. */
const EXPORT_KEY: Record<string, string> = {
  streaks: "streak",
  user_achievements: "achievements",
  user_roles: "roles",
};

describe("data export (art. 15, 20)", () => {
  it("has a key for every table that holds a user's data", async () => {
    const { data, error } = await A.client.rpc("export_my_data");
    expect(error).toBeNull();
    const keys = Object.keys(data as Record<string, unknown>);
    const missing = (await userTables()).filter((t) => !keys.includes(EXPORT_KEY[t] ?? t));
    expect(missing).toEqual([]);
    expect(keys).toContain("profile");
  });
});

describe("account deletion (art. 17)", () => {
  it("leaves no row with the user's id, keeps posts anonymised, forgets the newsletter", async () => {
    const victim = await createUser("erase");
    const db = admin();
    await db.from("lesson_progress").insert({ user_id: victim.id, lesson_id: "gone" });
    await db.from("xp_events").insert({
      user_id: victim.id,
      amount: 10,
      reason: "lesson",
      idempotency_key: `${victim.id}:erase`,
    });
    await db.from("notifications").insert({ user_id: victim.id, kind: "test" });
    const post = await db
      .from("comments")
      .insert({ user_id: victim.id, target_type: "lesson", target_id: "l1", body: "zostaje" })
      .select("id")
      .single();
    await db.from("newsletter_subscribers").insert({ email: victim.email.toUpperCase() });

    await deleteUser(victim);

    for (const table of await userTables()) {
      const { data, error } = await db
        .from(table as "lesson_progress")
        .select("user_id")
        .eq("user_id", victim.id);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
    const kept = await db
      .from("comments")
      .select("user_id, body")
      .eq("id", post.data?.id ?? -1)
      .single();
    expect(kept.data).toEqual({ user_id: null, body: "zostaje" });
    const sub = await db.from("newsletter_subscribers").select("id").ilike("email", victim.email);
    expect(sub.data).toEqual([]);
  });
});

describe("retention (privacy policy)", () => {
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  it("only the server can run it", async () => {
    expect((await anon().rpc("apply_retention")).error).not.toBeNull();
    expect((await A.client.rpc("apply_retention")).error).not.toBeNull();
  });

  it("redacts, deletes and keeps exactly what the policy says", async () => {
    const db = admin();
    const attempt = (days: number) => ({
      user_id: A.id,
      exercise_id: "retention-open",
      answer: { kind: "text", value: "moja odpowiedź" },
      score: 0.5,
      grader: "ai" as const,
      source: "app" as const,
      created_at: ago(days),
    });
    const { data: attempts } = await db
      .from("exercise_attempts")
      .insert([attempt(400), attempt(400), attempt(100)])
      .select("id");
    const [old, disputed, recent] = (attempts ?? []).map((a) => a.id);
    await db
      .from("grading_disputes")
      .insert({ user_id: A.id, attempt_id: disputed ?? -1, reason: "niesprawiedliwe" });
    await db.from("notifications").insert([
      { user_id: A.id, kind: "read-old", read_at: ago(95), created_at: ago(100) },
      { user_id: A.id, kind: "unread-recent", created_at: ago(100) },
      { user_id: A.id, kind: "unread-old", created_at: ago(400) },
    ]);
    await db.from("cron_runs").insert([
      { job: "retention", started_at: ago(100) },
      { job: "retention", started_at: ago(10) },
    ]);
    await db.from("audit_log").insert([
      { action: "retention.old", created_at: ago(800) },
      { action: "retention.recent", created_at: ago(30) },
    ]);
    await db.from("newsletter_subscribers").insert([
      { email: "unconfirmed-old@test.local", created_at: ago(8) },
      { email: "unconfirmed-new@test.local", created_at: ago(1) },
      { email: "unsubscribed-old@test.local", unsubscribed_at: ago(31), created_at: ago(60) },
      {
        email: "confirmed@test.local",
        confirmed_at: ago(60),
        created_at: ago(60),
      },
    ]);

    const { error } = await db.rpc("apply_retention");
    expect(error).toBeNull();

    const answers = await db
      .from("exercise_attempts")
      .select("id, answer, score")
      .in(
        "id",
        [old, disputed, recent].filter((v): v is number => v !== undefined),
      );
    const byId = new Map((answers.data ?? []).map((r) => [r.id, r]));
    expect(byId.get(old ?? -1)?.answer).toEqual({ kind: "text", redacted: true });
    expect(byId.get(old ?? -1)?.score).toBe(0.5);
    expect(byId.get(disputed ?? -1)?.answer).toMatchObject({ value: "moja odpowiedź" });
    expect(byId.get(recent ?? -1)?.answer).toMatchObject({ value: "moja odpowiedź" });

    const notes = await db.from("notifications").select("kind").eq("user_id", A.id);
    expect((notes.data ?? []).map((n) => n.kind).sort()).toEqual(["unread-recent"]);

    const runs = await db.from("cron_runs").select("started_at").eq("job", "retention");
    expect((runs.data ?? []).length).toBe(1);

    const audit = await db.from("audit_log").select("action").like("action", "retention.%");
    expect((audit.data ?? []).map((r) => r.action)).toEqual(["retention.recent"]);

    const subs = await db
      .from("newsletter_subscribers")
      .select("email")
      .like("email", "%@test.local");
    expect((subs.data ?? []).map((r) => r.email).sort()).toEqual([
      "confirmed@test.local",
      "unconfirmed-new@test.local",
    ]);

    await db.from("newsletter_subscribers").delete().like("email", "%@test.local");
    await db.from("audit_log").delete().like("action", "retention.%");
    await db.from("cron_runs").delete().eq("job", "retention");
  });
});
