import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, anon, createUser, deleteUser, type TestUser } from "./stack";

/**
 * Phase 21c: unusual XP is flagged for a person to review (never taken away), and no one
 * can earn more than 5,000 XP in 24 hours whatever goes wrong upstream.
 */
let heavy: TestUser;
let normal: TestUser;

beforeAll(async () => {
  heavy = await createUser("xp-heavy");
  normal = await createUser("xp-normal");
});
afterAll(async () => {
  await deleteUser(heavy);
  await deleteUser(normal);
});

const award = (user: TestUser, amount: number, reason = "exercise") =>
  admin()
    .from("xp_events")
    .insert({ user_id: user.id, amount, reason, idempotency_key: randomUUID() })
    .select("id");

describe("XP anomaly checks", () => {
  it("caps a user's XP at 5,000 per 24 hours; rows over the cap are skipped", async () => {
    expect((await award(heavy, 4000)).data).toHaveLength(1);
    expect((await award(heavy, 900)).data).toHaveLength(1);
    const over = await award(heavy, 200);
    expect(over.error).toBeNull();
    expect(over.data).toEqual([]);
    const { data } = await admin().from("xp_events").select("amount").eq("user_id", heavy.id);
    expect((data ?? []).reduce((s, r) => s + r.amount, 0)).toBe(4900);
  });

  it("flags 2,000+ XP in 24 hours for review, once a day, and leaves XP alone", async () => {
    await award(normal, 40);
    expect((await anon().rpc("flag_xp_anomalies")).error).not.toBeNull();
    expect((await normal.client.rpc("flag_xp_anomalies")).error).not.toBeNull();

    const first = await admin().rpc("flag_xp_anomalies");
    expect(first.error).toBeNull();
    const { data: flags } = await admin()
      .from("xp_flags")
      .select("user_id, xp, reason, status")
      .in("user_id", [heavy.id, normal.id]);
    expect(flags).toEqual([{ user_id: heavy.id, xp: 4900, reason: "volume", status: "pending" }]);
    // Run again the same day: no second flag.
    await admin().rpc("flag_xp_anomalies");
    const { count } = await admin()
      .from("xp_flags")
      .select("id", { count: "exact", head: true })
      .eq("user_id", heavy.id);
    expect(count).toBe(1);
    const { data: xp } = await admin().from("xp_events").select("amount").eq("user_id", heavy.id);
    expect((xp ?? []).reduce((s, r) => s + r.amount, 0)).toBe(4900);
  });

  it("users see their own flag (it's their data) but nobody else's, and can't write any", async () => {
    const own = await heavy.client.from("xp_flags").select("user_id");
    expect(own.data?.map((r) => r.user_id)).toEqual([heavy.id]);
    const other = await normal.client.from("xp_flags").select("id");
    expect(other.data).toEqual([]);
    const write = await normal.client
      .from("xp_flags")
      .insert({ user_id: normal.id, day: "2026-01-01", xp: 1, reason: "volume" });
    expect(write.error).not.toBeNull();
  });
});
