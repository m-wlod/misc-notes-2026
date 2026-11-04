import { describe, expect, it } from "vitest";

import { admin, anon } from "./stack";

/** Phase 22a: an alert is claimed once per key per day, by server code only. */
describe("alert_log", () => {
  it("the second claim of the same key on the same day gets nothing", async () => {
    const db = admin();
    const row = { day: "2026-01-02", key: `test-${String(Date.now())}`, subject: "Test" };
    const first = await db
      .from("alert_log")
      .upsert(row, { onConflict: "day,key", ignoreDuplicates: true })
      .select("key");
    expect(first.data).toHaveLength(1);
    const second = await db
      .from("alert_log")
      .upsert(row, { onConflict: "day,key", ignoreDuplicates: true })
      .select("key");
    expect(second.data).toEqual([]);
    const nextDay = await db
      .from("alert_log")
      .upsert({ ...row, day: "2026-01-03" }, { onConflict: "day,key", ignoreDuplicates: true })
      .select("key");
    expect(nextDay.data).toHaveLength(1);
    await db.from("alert_log").delete().eq("key", row.key);
  });

  it("nobody else reads or writes it, and only the server prunes it", async () => {
    expect((await anon().from("alert_log").select("key")).data ?? []).toEqual([]);
    expect(
      (await anon().from("alert_log").insert({ day: "2026-01-02", key: "x", subject: "x" })).error,
    ).not.toBeNull();
    expect((await anon().rpc("prune_alert_log")).error).not.toBeNull();
    expect((await admin().rpc("prune_alert_log")).error).toBeNull();
  });
});
