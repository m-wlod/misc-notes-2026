/**
 * The Debunk Lab moderation queue (Phase 16) on the real database: a signed-out
 * submission written by the server lands as pending; a learner can't approve anything;
 * a moderator can, and sees the queue.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, createUser, deleteUser, type TestUser } from "./stack";

let learner: TestUser | undefined;
let moderator: TestUser | undefined;
let id = 0;

beforeAll(async () => {
  learner = await createUser("debunk-learner");
  moderator = await createUser("debunk-mod");
  await admin().from("user_roles").insert({ user_id: moderator.id, role: "moderator" });
  const { data } = await admin()
    .from("debunk_submissions")
    .insert({ user_id: null, claim: "Ten wskaźnik ma 95% trafności, sprawdźcie." })
    .select("id, status")
    .single();
  id = data?.id ?? 0;
  expect(data?.status).toBe("pending");
});

afterAll(async () => {
  await admin().from("debunk_submissions").delete().eq("id", id);
  await deleteUser(learner);
  await deleteUser(moderator);
});

describe("debunk queue", () => {
  it("a learner can't see or approve someone else's submission", async () => {
    const l = learner as TestUser;
    const { data } = await l.client.from("debunk_submissions").select("id").eq("id", id);
    expect(data).toEqual([]);
    await l.client.from("debunk_submissions").update({ status: "approved" }).eq("id", id);
    const { data: row } = await admin()
      .from("debunk_submissions")
      .select("status")
      .eq("id", id)
      .single();
    expect(row?.status).toBe("pending");
  });

  it("a learner's own submission is pending and can't be self-approved", async () => {
    const l = learner as TestUser;
    const { error: bad } = await l.client
      .from("debunk_submissions")
      .insert({ user_id: l.id, claim: "Wysłane od razu jako zatwierdzone", status: "approved" });
    expect(bad).not.toBeNull();
    const { error } = await l.client
      .from("debunk_submissions")
      .insert({ user_id: l.id, claim: "Grid bot zawsze wychodzi na plus." });
    expect(error).toBeNull();
  });

  it("a moderator sees the queue but resolves only through the app (Phase 21)", async () => {
    const m = moderator as TestUser;
    const { data: staff } = await m.client.rpc("is_staff");
    expect(staff).toBe(true);
    const { data } = await m.client.from("debunk_submissions").select("id").eq("id", id);
    expect(data).toHaveLength(1);
    // No direct write: resolving goes through the server action, which audits it.
    const { data: changed } = await m.client
      .from("debunk_submissions")
      .update({ status: "approved", reviewed_by: m.id })
      .eq("id", id)
      .select();
    expect(changed ?? []).toEqual([]);
    const { data: row } = await admin()
      .from("debunk_submissions")
      .select("status")
      .eq("id", id)
      .single();
    expect(row).toEqual({ status: "pending" });
  });
});
