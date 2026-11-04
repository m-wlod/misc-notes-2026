import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, createUser, deleteUser, type TestUser } from "./stack";

/**
 * Phase 22c: learning analytics for staff. The numbers come straight from the data, only
 * server-graded attempts count, and learners can't read them.
 */
let reviewer: TestUser;
let learner: TestUser;
let other: TestUser;
const lesson = `learning-test-${randomUUID().slice(0, 8)}`;
const exercise = `learning-ex-${randomUUID().slice(0, 8)}`;
const today = new Date().toISOString().slice(0, 10);
const range = { from_day: "2000-01-01", to_day: today };

beforeAll(async () => {
  reviewer = await createUser("learning-reviewer");
  learner = await createUser("learning-learner");
  other = await createUser("learning-other");
  const db = admin();
  await db.from("user_roles").insert({ user_id: reviewer.id, role: "reviewer" });
  const old = new Date(Date.now() - 20 * 86_400_000).toISOString();
  const now = new Date().toISOString();
  // Every row names the same columns: in a batch insert a missing one becomes NULL.
  const { error } = await db.from("lesson_progress").insert([
    { user_id: learner.id, lesson_id: lesson, status: "completed", updated_at: now },
    // Stopped 20 days ago: stalled (set on insert; the update trigger would overwrite it).
    { user_id: other.id, lesson_id: lesson, status: "in_progress", updated_at: old },
    { user_id: reviewer.id, lesson_id: lesson, status: "in_progress", updated_at: now },
  ]);
  if (error) throw error;
  const attempt = (user: string, score: number, hints: number, source = "app") => ({
    user_id: user,
    exercise_id: exercise,
    answer: { kind: "text", value: "1" },
    score,
    grader: "auto" as const,
    hints_used: hints,
    source: source as "app" | "anonymous_import",
  });
  await db
    .from("exercise_attempts")
    .insert([
      attempt(learner.id, 1, 0),
      attempt(learner.id, 0, 2),
      attempt(other.id, 1, 1),
      attempt(other.id, 1, 5, "anonymous_import"),
    ]);
});

afterAll(async () => {
  for (const u of [reviewer, learner, other]) await deleteUser(u);
});

describe("learning analytics (staff)", () => {
  it("lesson drop-off: started, completed, stalled", async () => {
    const { data, error } = await reviewer.client.rpc("admin_learning_lessons", range);
    expect(error).toBeNull();
    // The stalled row was touched 20 days ago: still inside this range.
    expect(data?.find((r) => r.lesson_id === lesson)).toEqual({
      lesson_id: lesson,
      started: 3,
      completed: 1,
      stalled: 1,
    });
  });

  it("hints: server-graded attempts only", async () => {
    const { data, error } = await reviewer.client.rpc("admin_learning_hints", range);
    expect(error).toBeNull();
    expect(data?.find((r) => r.exercise_id === exercise)).toEqual({
      exercise_id: exercise,
      attempts: 3,
      hints: 3,
      solves: 2,
      solves_with_hints: 1,
    });
  });

  it("learners can't read them", async () => {
    expect((await learner.client.rpc("admin_learning_lessons", range)).error).not.toBeNull();
    expect((await learner.client.rpc("admin_learning_hints", range)).error).not.toBeNull();
  });
});
