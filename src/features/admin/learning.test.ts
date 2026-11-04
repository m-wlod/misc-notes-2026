import { describe, expect, it } from "vitest";

import { hintsByLevel, lessonDropoff } from "./learning";

describe("lesson drop-off (Phase 22c)", () => {
  it("worst completion first among lessons with enough starts; thin data last", () => {
    const rows = [
      { lesson_id: "a", started: 10, completed: 9, stalled: 0 },
      { lesson_id: "b", started: 20, completed: 5, stalled: 8 },
      { lesson_id: "c", started: 2, completed: 0, stalled: 2 },
      { lesson_id: "d", started: 10, completed: 5, stalled: 1 },
    ];
    const out = lessonDropoff(rows);
    expect(out.map((r) => r.lesson_id)).toEqual(["b", "d", "a", "c"]);
    expect(out[0]?.rate).toBe(0.25);
  });
});

describe("hints by level (Phase 22c)", () => {
  it("adds exercises up per level, all five levels shown", () => {
    const levels: Record<string, number> = { e1: 1, e2: 1, e3: 3 };
    const out = hintsByLevel(
      [
        { exercise_id: "e1", attempts: 10, hints: 5, solves: 8, solves_with_hints: 2 },
        { exercise_id: "e2", attempts: 10, hints: 15, solves: 2, solves_with_hints: 2 },
        { exercise_id: "e3", attempts: 4, hints: 0, solves: 1, solves_with_hints: 0 },
        { exercise_id: "gone", attempts: 99, hints: 99, solves: 0, solves_with_hints: 0 },
      ],
      (id) => levels[id],
    );
    expect(out[0]).toEqual({
      level: 1,
      attempts: 20,
      hintsPerAttempt: 1,
      solves: 10,
      hintedShare: 0.4,
    });
    expect(out[2]).toMatchObject({ level: 3, attempts: 4, hintsPerAttempt: 0, hintedShare: 0 });
    expect(out[4]).toEqual({
      level: 5,
      attempts: 0,
      hintsPerAttempt: 0,
      solves: 0,
      hintedShare: null,
    });
  });
});
