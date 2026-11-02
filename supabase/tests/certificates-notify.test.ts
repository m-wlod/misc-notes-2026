/**
 * Phase 15 against the real database: a certificate is verifiable publicly (and only
 * that row's public fields come back), and the notification log dedupes sends.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { supabaseNotifyStore } = await import("../../src/features/notify/supabase-store");

import { admin, anon, createUser, deleteUser, type TestUser } from "./stack";

let A: TestUser | undefined;

beforeAll(async () => {
  A = await createUser("cert-a");
});
afterAll(async () => {
  await deleteUser(A);
});

describe("certificates", () => {
  it("verify_certificate answers anyone for a real id, nothing for an unknown one", async () => {
    const a = A as TestUser;
    const { data: cert, error } = await admin()
      .from("certificates")
      .insert({ user_id: a.id, track_id: "foundations", score: 0.9 })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { data } = await anon().rpc("verify_certificate", { certificate_id: cert?.id ?? "" });
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ track_id: "foundations" });
    expect(Object.keys(data?.[0] ?? {}).sort()).toEqual(
      ["display_name", "handle", "issued_at", "track_id"].sort(),
    );
    const none = await anon().rpc("verify_certificate", { certificate_id: randomUUID() });
    expect(none.data).toEqual([]);
  });

  it("learners can't issue themselves a certificate", async () => {
    const a = A as TestUser;
    const { error } = await a.client
      .from("certificates")
      .insert({ user_id: a.id, track_id: "probability" });
    expect(error).not.toBeNull();
  });
});

describe("notification log", () => {
  it("records a send once and finds it by key", async () => {
    const a = A as TestUser;
    const store = supabaseNotifyStore(admin());
    expect(await store.sent(a.id, "streak:2026-11-02")).toBe(false);
    await store.markSent(a.id, "streak:2026-11-02", "streak", { days: 3 });
    expect(await store.sent(a.id, "streak:2026-11-02")).toBe(true);
    expect(await store.sent(a.id, "streak:2026-11-03")).toBe(false);
  });

  it("one-click switch-off writes the preference row", async () => {
    const a = A as TestUser;
    const db = admin();
    const { error } = await db
      .from("notification_prefs")
      .upsert({ user_id: a.id, email_weekly: false }, { onConflict: "user_id" });
    expect(error).toBeNull();
    const { data } = await db
      .from("notification_prefs")
      .select("email_streak, email_weekly, email_league")
      .eq("user_id", a.id)
      .single();
    expect(data).toEqual({ email_streak: true, email_weekly: false, email_league: true });
  });
});
