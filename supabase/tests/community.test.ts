/**
 * Community rules on the real database (Phase 17): the spoiler gate can't be bypassed
 * through the REST API, banned users can't post by any route, vote totals don't expose
 * voters, moderation is staff-only and the audit log isn't writable by users.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, anon, createUser, deleteUser, type TestUser } from "./stack";

const EX = `gate-${Date.now().toString(36)}`;
let author: TestUser | undefined; // solved EX, posts
let reader: TestUser | undefined; // hasn't solved EX yet
let importer: TestUser | undefined; // only an imported (browser) attempt
let mod: TestUser | undefined;
let commentId = 0;
let solutionId = 0;
let lessonCommentId = 0;

const as = (u: TestUser | undefined) => (u as TestUser).client;

beforeAll(async () => {
  author = await createUser("comm-author");
  reader = await createUser("comm-reader");
  importer = await createUser("comm-import");
  mod = await createUser("comm-mod");
  await admin().from("user_roles").insert({ user_id: mod.id, role: "moderator" });
  const seed = await admin()
    .from("exercise_attempts")
    .insert([
      { user_id: author.id, exercise_id: EX, answer: {}, score: 1, grader: "auto", source: "app" },
      {
        user_id: importer.id,
        exercise_id: EX,
        answer: {},
        score: 1,
        grader: "auto",
        source: "anonymous_import",
      },
    ]);
  if (seed.error) throw seed.error;
  const c = await as(author)
    .from("comments")
    .insert({ user_id: author.id, target_type: "exercise", target_id: EX, body: "Wskazówka: EV." })
    .select("id")
    .single();
  if (c.error) throw c.error;
  commentId = c.data.id;
  const s = await as(author)
    .from("shared_solutions")
    .insert({ user_id: author.id, exercise_id: EX, format: "text", body: "Odpowiedź: 0,25." })
    .select("id")
    .single();
  if (s.error) throw s.error;
  solutionId = s.data.id;
  const l = await as(author)
    .from("comments")
    .insert({ user_id: author.id, target_type: "lesson", target_id: "l-gate", body: "Dzięki!" })
    .select("id")
    .single();
  if (l.error) throw l.error;
  lessonCommentId = l.data.id;
});

afterAll(async () => {
  await admin().from("comments").delete().in("id", [commentId, lessonCommentId]);
  await admin().from("shared_solutions").delete().eq("id", solutionId);
  for (const u of [author, reader, importer, mod]) await deleteUser(u);
});

describe("spoiler gate", () => {
  it("lesson threads are public, exercise threads aren't (signed out)", async () => {
    const { data: lesson } = await anon().from("comments").select("id").eq("id", lessonCommentId);
    expect(lesson).toHaveLength(1);
    const { data: ex } = await anon().from("comments").select("id").eq("target_id", EX);
    expect(ex).toEqual([]);
  });

  it("an unsolved reader can't read the thread or solutions, or post there", async () => {
    const { data: comments } = await as(reader).from("comments").select("id").eq("target_id", EX);
    expect(comments).toEqual([]);
    const { data: sols } = await as(reader)
      .from("shared_solutions")
      .select("id")
      .eq("exercise_id", EX);
    expect(sols).toEqual([]);
    const { data: open } = await as(reader).rpc("discussion_unlocked", { exercise_id: EX });
    expect(open).toBe(false);
    const { error } = await as(reader)
      .from("shared_solutions")
      .insert({ user_id: (reader as TestUser).id, exercise_id: EX, format: "text", body: "x" });
    expect(error).not.toBeNull();
  });

  it("users can't write their own attempts to open the gate", async () => {
    const { error } = await as(reader)
      .from("exercise_attempts")
      .insert({
        user_id: (reader as TestUser).id,
        exercise_id: EX,
        answer: {},
        score: 1,
        grader: "auto",
      });
    expect(error).not.toBeNull();
  });

  it("an imported (browser-scored) attempt doesn't unlock", async () => {
    const { data } = await as(importer).from("comments").select("id").eq("target_id", EX);
    expect(data).toEqual([]);
  });

  it("solving or revealing opens it", async () => {
    const r = reader as TestUser;
    const { error } = await admin()
      .from("exercise_attempts")
      .insert({
        user_id: r.id,
        exercise_id: EX,
        answer: { revealed: true },
        score: 0,
        grader: "self",
      });
    expect(error).toBeNull();
    const { data: comments } = await r.client.from("comments").select("id").eq("target_id", EX);
    expect(comments).toEqual([{ id: commentId }]);
    const { data: sols } = await r.client
      .from("shared_solutions")
      .select("id")
      .eq("exercise_id", EX);
    expect(sols).toEqual([{ id: solutionId }]);
  });
});

describe("votes", () => {
  it("totals are public, voters aren't", async () => {
    const { error } = await as(reader)
      .from("votes")
      .insert({
        user_id: (reader as TestUser).id,
        target_type: "solution",
        target_id: solutionId,
        value: 1,
      });
    expect(error).toBeNull();
    const { data: totals } = await anon().rpc("vote_totals", {
      target_type: "solution",
      ids: [solutionId],
    });
    expect(totals).toEqual([{ target_id: solutionId, total: 1 }]);
    const { data: rows } = await as(author)
      .from("votes")
      .select("user_id")
      .eq("target_id", solutionId);
    expect(rows).toEqual([]);
    const { data: rep } = await anon().rpc("reputation", { uid: (author as TestUser).id });
    expect(rep).toBe(1);
  });
});

describe("moderation", () => {
  it("a learner can't hide others' posts; the author can't unhide a hidden one", async () => {
    await as(reader).from("comments").update({ status: "hidden" }).eq("id", lessonCommentId);
    const { data: still } = await admin()
      .from("comments")
      .select("status")
      .eq("id", lessonCommentId)
      .single();
    expect(still?.status).toBe("approved");

    // A moderator hides it through the app (server code, secret key): Phase 21 removed
    // direct staff writes, so the moderator's own client changes nothing.
    const { data: direct } = await as(mod)
      .from("comments")
      .update({ status: "hidden" })
      .eq("id", lessonCommentId)
      .select("id");
    expect(direct ?? []).toEqual([]);
    const { error } = await admin()
      .from("comments")
      .update({ status: "hidden" })
      .eq("id", lessonCommentId);
    expect(error).toBeNull();
    // Shadow-hidden: the author still sees it, others don't.
    const { data: own } = await as(author).from("comments").select("id").eq("id", lessonCommentId);
    expect(own).toHaveLength(1);
    const { data: others } = await anon().from("comments").select("id").eq("id", lessonCommentId);
    expect(others).toEqual([]);

    await as(author)
      .from("comments")
      .update({ status: "approved", body: "znowu" })
      .eq("id", lessonCommentId);
    const { data: after } = await admin()
      .from("comments")
      .select("status")
      .eq("id", lessonCommentId)
      .single();
    expect(after?.status).toBe("hidden");
  });

  it("users can't write the audit log or bans; staff can read them", async () => {
    const r = reader as TestUser;
    const { error: auditErr } = await r.client
      .from("audit_log")
      .insert({ actor_id: r.id, action: "comment.hidden", target: "comment:1" });
    expect(auditErr).not.toBeNull();
    const { error: banErr } = await r.client
      .from("bans")
      .insert({ user_id: (author as TestUser).id, reason: "nope" });
    expect(banErr).not.toBeNull();
    const { error: readErr } = await as(mod).from("bans").select("user_id");
    expect(readErr).toBeNull();
  });

  it("a banned user can't comment, share, vote or report", async () => {
    const a = author as TestUser;
    const { error } = await admin().from("bans").insert({ user_id: a.id, reason: "test" });
    expect(error).toBeNull();
    const { data: banned } = await a.client.rpc("is_banned");
    expect(banned).toBe(true);
    const attempts = await Promise.all([
      a.client
        .from("comments")
        .insert({ user_id: a.id, target_type: "lesson", target_id: "l-gate", body: "x" }),
      a.client
        .from("shared_solutions")
        .insert({ user_id: a.id, exercise_id: EX, format: "text", body: "x" }),
      a.client
        .from("votes")
        .insert({ user_id: a.id, target_type: "comment", target_id: commentId, value: 1 }),
      a.client
        .from("reports")
        .insert({ user_id: a.id, target_type: "comment", target_id: "1", reason: "x" }),
    ]);
    for (const r of attempts) expect(r.error).not.toBeNull();
    // An expired ban lifts itself.
    await admin()
      .from("bans")
      .update({ until: new Date(Date.now() - 1000).toISOString() })
      .eq("user_id", a.id);
    const { data: lifted } = await a.client.rpc("is_banned");
    expect(lifted).toBe(false);
  });
});

describe("posting to a locked thread", () => {
  it("is refused through the API too", async () => {
    const i = importer as TestUser;
    const { error } = await i.client
      .from("comments")
      .insert({ user_id: i.id, target_type: "exercise", target_id: EX, body: "pytanie" });
    expect(error).not.toBeNull();
  });
});
