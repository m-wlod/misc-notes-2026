/** Signup trigger, RODO export and account deletion (cascade + anonymised comments). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, anon, createUser, deleteUser, type TestUser } from "./stack";

let A: TestUser, B: TestUser;

beforeAll(async () => {
  [A, B] = await Promise.all([createUser("acct-a"), createUser("acct-b")]);
});
afterAll(async () => {
  await Promise.all([deleteUser(A), deleteUser(B)]);
});

describe("signup trigger", () => {
  it("creates a profile with a generated handle, a free entitlement and a streak", async () => {
    const db = admin();
    const profile = await db.from("profiles").select("*").eq("id", A.id).single();
    expect(profile.data?.handle).toMatch(/^user_[0-9a-f]{12}$/);
    expect(profile.data?.locale).toBe("pl");
    expect(profile.data?.daily_goal_minutes).toBe(10);
    expect(profile.data?.is_public).toBe(false);

    const plans = await db.from("entitlements").select("plan").eq("user_id", A.id);
    expect(plans.data).toEqual([{ plan: "free" }]);
    const streak = await db.from("streaks").select("current_days").eq("user_id", A.id).single();
    expect(streak.data?.current_days).toBe(0);
  });

  it("takes the locale from signup metadata, falling back to Polish for unknown values", async () => {
    const db = admin();
    const en = await db.auth.admin.createUser({
      email: `en-${A.id}@test.local`,
      email_confirm: true,
      user_metadata: { locale: "en" },
    });
    const xx = await db.auth.admin.createUser({
      email: `xx-${A.id}@test.local`,
      email_confirm: true,
      user_metadata: { locale: "de" },
    });
    try {
      const en_ = await db
        .from("profiles")
        .select("locale")
        .eq("id", en.data.user?.id ?? "")
        .single();
      const xx_ = await db
        .from("profiles")
        .select("locale")
        .eq("id", xx.data.user?.id ?? "")
        .single();
      expect(en_.data?.locale).toBe("en");
      expect(xx_.data?.locale).toBe("pl");
    } finally {
      for (const u of [en.data.user, xx.data.user]) if (u) await db.auth.admin.deleteUser(u.id);
    }
  });
});

describe("profile constraints", () => {
  it("rejects invalid handles and daily goals", async () => {
    const bad1 = await A.client.from("profiles").update({ handle: "Has Spaces!" }).eq("id", A.id);
    expect(bad1.error?.code).toBe("23514");
    const bad2 = await A.client.from("profiles").update({ daily_goal_minutes: 7 }).eq("id", A.id);
    expect(bad2.error?.code).toBe("23514");
  });

  it("enforces unique handles case-insensitively", async () => {
    const ok = await A.client
      .from("profiles")
      .update({ handle: `kwant_${A.id.slice(0, 6)}` })
      .eq("id", A.id);
    expect(ok.error).toBeNull();
    const dup = await B.client
      .from("profiles")
      .update({ handle: `KWANT_${A.id.slice(0, 6)}`.toLowerCase() })
      .eq("id", B.id);
    expect(dup.error?.code).toBe("23505");
  });
});

describe("export_my_data()", () => {
  it("returns only the caller's rows, and nothing for anonymous callers", async () => {
    const db = admin();
    await db.from("lesson_progress").insert([
      { user_id: A.id, lesson_id: "export-a" },
      { user_id: B.id, lesson_id: "export-b" },
    ]);
    const { data, error } = await A.client.rpc("export_my_data");
    expect(error).toBeNull();
    const doc = data as {
      user_id: string;
      profile: { id: string };
      lesson_progress: { lesson_id: string }[];
    };
    expect(doc.user_id).toBe(A.id);
    expect(doc.profile.id).toBe(A.id);
    expect(doc.lesson_progress.map((r) => r.lesson_id)).toEqual(["export-a"]);
    expect(JSON.stringify(doc)).not.toContain(B.id);

    const asAnon = await anon().rpc("export_my_data");
    expect(asAnon.data ?? null).toBeNull();
  });
});

describe("account deletion", () => {
  it("cascades private rows and anonymises public comments", async () => {
    const victim = await createUser("victim");
    const db = admin();
    await db.from("lesson_progress").insert({ user_id: victim.id, lesson_id: "gone" });
    const comment = await db
      .from("comments")
      .insert({ user_id: victim.id, target_type: "lesson", target_id: "l1", body: "zostaje" })
      .select("id")
      .single();

    await deleteUser(victim);

    const profile = await db.from("profiles").select("*").eq("id", victim.id);
    expect(profile.data, "profiles").toEqual([]);
    for (const table of ["entitlements", "streaks"] as const) {
      const { data } = await db.from(table).select("*").eq("user_id", victim.id);
      expect(data, table).toEqual([]);
    }
    const progress = await db.from("lesson_progress").select("*").eq("user_id", victim.id);
    expect(progress.data).toEqual([]);
    const kept = await db
      .from("comments")
      .select("user_id, body")
      .eq("id", comment.data?.id ?? -1)
      .single();
    expect(kept.data).toEqual({ user_id: null, body: "zostaje" });
  });
});
