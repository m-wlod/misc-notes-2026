import { describe, expect, it } from "vitest";

import {
  emptyLocalProgress,
  lessonUpserts,
  localProgressSchema,
  mergeStatus,
  type LessonStatus,
} from "./schema";

const valid = {
  version: 1,
  lessons: {
    "fundamenty/stopy-zwrotu": { status: "completed", updatedAt: "2026-11-01T10:00:00Z" },
  },
  attempts: [
    {
      clientId: "3f8a1c2e-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
      exerciseId: "ev-die-1",
      score: 1,
      answer: { raw: "3,5" },
      createdAt: "2026-11-01T10:05:00Z",
    },
  ],
};

describe("localProgressSchema", () => {
  it("accepts well-formed local progress", () => {
    expect(localProgressSchema.safeParse(valid).success).toBe(true);
    expect(localProgressSchema.safeParse(emptyLocalProgress()).success).toBe(true);
  });

  it.each([
    ["wrong version", { ...valid, version: 2 }],
    ["score above 1", { ...valid, attempts: [{ ...valid.attempts[0], score: 1.5 }] }],
    ["non-uuid client id", { ...valid, attempts: [{ ...valid.attempts[0], clientId: "x" }] }],
    [
      "unknown status",
      { ...valid, lessons: { a: { status: "hacked", updatedAt: "2026-11-01T10:00:00Z" } } },
    ],
    [
      "id with spaces",
      { ...valid, lessons: { "a b": { status: "completed", updatedAt: "2026-11-01T10:00:00Z" } } },
    ],
    [
      "too many attempts",
      { ...valid, attempts: Array.from({ length: 1001 }, () => valid.attempts[0]) },
    ],
    ["null answer", { ...valid, attempts: [{ ...valid.attempts[0], answer: null }] }],
    ["garbage", "not an object"],
  ])("rejects %s", (_name, input) => {
    expect(localProgressSchema.safeParse(input).success).toBe(false);
  });
});

describe("mergeStatus", () => {
  it.each([
    [undefined, "in_progress", "in_progress"],
    ["in_progress", "completed", "completed"],
    ["mastered", "in_progress", "mastered"], // never downgrade
    ["completed", "completed", "completed"],
  ] as const)("%s + %s → %s", (current, incoming, expected) => {
    expect(mergeStatus(current, incoming)).toBe(expected);
  });
});

describe("lessonUpserts", () => {
  it("only upserts lessons where local progress is ahead", () => {
    const local = {
      a: { status: "completed" as const, updatedAt: "2026-11-01T10:00:00Z" },
      b: { status: "in_progress" as const, updatedAt: "2026-11-01T10:00:00Z" },
      c: { status: "in_progress" as const, updatedAt: "2026-11-01T10:00:00Z" },
    };
    const existing = new Map<string, LessonStatus>([
      ["a", "in_progress"],
      ["b", "mastered"],
    ]);
    expect(lessonUpserts(local, existing)).toEqual([
      { lesson_id: "a", status: "completed" },
      { lesson_id: "c", status: "in_progress" },
    ]);
  });

  it("is idempotent: merging the same payload twice changes nothing the second time", () => {
    const local = { a: { status: "completed" as const, updatedAt: "2026-11-01T10:00:00Z" } };
    const first = lessonUpserts(local, new Map());
    const afterFirst = new Map(first.map((r) => [r.lesson_id, r.status]));
    expect(lessonUpserts(local, afterFirst)).toEqual([]);
  });
});
