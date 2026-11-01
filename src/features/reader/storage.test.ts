import { describe, expect, it } from "vitest";

import { minutesLeft, parseReading, withLessonStatus, withSection } from "./storage";

const now = new Date("2026-11-01T12:00:00Z");
const statusOf = (raw: string, id: string) =>
  (JSON.parse(raw) as { lessons: Record<string, { status: string }> }).lessons[id]?.status;

describe("withLessonStatus", () => {
  it("starts and completes a lesson", () => {
    const started = withLessonStatus(null, "a", "in_progress", now);
    expect(statusOf(started, "a")).toBe("in_progress");
    expect(statusOf(withLessonStatus(started, "a", "completed", now), "a")).toBe("completed");
  });

  it("never moves backwards and keeps other lessons", () => {
    const done = withLessonStatus(
      withLessonStatus(null, "b", "completed", now),
      "a",
      "completed",
      now,
    );
    const again = withLessonStatus(done, "a", "in_progress", now);
    expect(statusOf(again, "a")).toBe("completed");
    expect(statusOf(again, "b")).toBe("completed");
  });

  it("replaces garbage with a valid payload", () => {
    const raw = withLessonStatus("{not json", "a", "in_progress", now);
    expect(JSON.parse(raw)).toMatchObject({ version: 1, attempts: [] });
  });
});

describe("withSection", () => {
  const order = ["s1", "s2", "s3"];
  it("keeps the furthest section", () => {
    let raw = withSection(null, "a", "s2", order, now);
    raw = withSection(raw, "a", "s1", order, now);
    expect(parseReading(raw).lessons.a?.section).toBe("s2");
    raw = withSection(raw, "a", "s3", order, now);
    expect(parseReading(raw).lessons.a?.section).toBe("s3");
  });

  it("rejects malformed state", () => {
    expect(parseReading(JSON.stringify({ version: 2, lessons: {} })).lessons).toEqual({});
  });
});

describe("minutesLeft", () => {
  it.each([
    [10, 0, 10],
    [10, 0.42, 6],
    [10, 1, 0],
    [8, 1.5, 0],
    [8, -1, 8],
  ])("%d min at %d → %d", (minutes, fraction, expected) => {
    expect(minutesLeft(minutes, fraction)).toBe(expected);
  });
});
