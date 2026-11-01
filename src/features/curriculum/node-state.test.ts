import { describe, expect, it } from "vitest";

import type { LessonStatus } from "@/features/progress/schema";

import { finishedCount, missingPrerequisites, nodeState } from "./node-state";

const statuses = (entries: Record<string, LessonStatus>) => new Map(Object.entries(entries));

describe("nodeState", () => {
  it("a lesson without prerequisites is available from the start", () => {
    expect(nodeState("a", [], new Map())).toBe("available");
  });

  it("unfinished prerequisites lock a lesson; finished ones unlock it", () => {
    expect(nodeState("c", ["a", "b"], statuses({ a: "completed" }))).toBe("locked");
    expect(nodeState("c", ["a", "b"], statuses({ a: "completed", b: "in_progress" }))).toBe(
      "locked",
    );
    expect(nodeState("c", ["a", "b"], statuses({ a: "completed", b: "mastered" }))).toBe(
      "available",
    );
  });

  it("the lesson's own progress wins over prerequisites", () => {
    expect(nodeState("c", ["a"], statuses({ c: "in_progress" }))).toBe("in_progress");
    expect(nodeState("c", ["a"], statuses({ c: "completed" }))).toBe("done");
    expect(nodeState("c", ["a"], statuses({ c: "mastered" }))).toBe("mastered");
  });

  it("not_started counts as no progress", () => {
    expect(nodeState("c", ["a"], statuses({ a: "not_started", c: "not_started" }))).toBe("locked");
  });
});

describe("missingPrerequisites / finishedCount", () => {
  it("lists unfinished prerequisites in order and counts finished lessons", () => {
    const s = statuses({ a: "completed", b: "in_progress", d: "mastered" });
    expect(missingPrerequisites(["b", "a", "c"], s)).toEqual(["b", "c"]);
    expect(finishedCount(["a", "b", "c", "d"], s)).toBe(2);
  });
});
