import { describe, expect, it } from "vitest";

import { validateExercises } from "./validate";

const ok = {
  id: "ex-a",
  type: "choice",
  level: 1,
  topics: ["t"],
  lessonIds: ["l"],
  prompt: { pl: "Pytanie?" },
  options: [
    { id: "a", pl: "A" },
    { id: "b", pl: "B" },
  ],
  answer: "a",
  estimatedMinutes: 1,
  status: "draft",
};

describe("validateExercises", () => {
  it("accepts a valid exercise", () => {
    expect(validateExercises([{ file: "x.yaml", data: ok }], [{ id: "l" }])).toEqual([]);
  });

  it("reports schema, rule, duplicate and lesson problems with the file", () => {
    const errors = validateExercises(
      [
        { file: "a.yaml", data: { ...ok, answer: "zzz", lessonIds: ["ghost"] } },
        { file: "b.yaml", data: ok },
        { file: "c.yaml", data: { ...ok, id: "c", level: 9 } },
        { file: "d.yaml", data: { ...ok, id: "d", type: "numeric", answer: 1 } },
        { file: "e.yaml", data: { ...ok, id: "e", type: "teleport" } },
      ],
      [{ id: "l" }],
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'a.yaml: answer: "zzz" is not one of the option ids',
        'a.yaml: lessonIds[0]: unknown lesson "ghost"',
        'b.yaml: id: "ex-a" is already used by a.yaml',
        expect.stringMatching(/^c\.yaml: level: /),
        expect.stringMatching(/^d\.yaml: /),
        expect.stringMatching(/^e\.yaml: type: /),
      ]),
    );
  });
});
