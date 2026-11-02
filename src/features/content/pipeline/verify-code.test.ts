import { describe, expect, it } from "vitest";

import { exerciseRuleErrors, exerciseSchema, type Exercise } from "@/features/exercises/schema";

import { verifyCodeExercises } from "./verify-code";

/** A small code exercise (no pandas, so the check runs with any Python). */
function exercise(over: Record<string, unknown> = {}): Exercise {
  return exerciseSchema.parse({
    id: "kod",
    type: "code",
    level: 1,
    topics: ["t"],
    lessonIds: ["l"],
    prompt: { pl: "p" },
    estimatedMinutes: 1,
    status: "draft",
    starter: "def double(x):\n    ...\n",
    examples: "assert double(3) == 6",
    tests: [
      { code: "assert double(2) == 4", message: { pl: "2 → 4" } },
      { code: "assert double(-1.5) == -3", message: { pl: "-1,5 → -3" } },
    ],
    solutionCode: "def double(x):\n    return 2 * x\n",
    answerExpr: "double(21)",
    answer: 42,
    ...over,
  });
}
const check = (ex: Exercise) => verifyCodeExercises([{ file: "kod.yaml", exercise: ex }]);

describe("code exercises in content:verify (real Python)", { timeout: 60_000 }, () => {
  it("accepts a solution that passes, a starter that fails and a matching answer", () => {
    expect(check(exercise())).toEqual({ checked: 1, errors: [] });
  });

  it("reports a reference solution that fails a test or the examples", () => {
    const { errors } = check(exercise({ solutionCode: "def double(x):\n    return x + 2\n" }));
    expect(errors).toEqual([
      expect.stringMatching(/kod\.yaml: solutionCode fails tests\[1\]: AssertionError/),
      expect.stringMatching(/kod\.yaml: solutionCode fails examples: AssertionError/),
      expect.stringMatching(/kod\.yaml: answerExpr: expected 42, got 23/),
    ]);
  });

  it("reports a stored answer that differs from answerExpr", () => {
    expect(check(exercise({ answer: 41 })).errors).toEqual([
      expect.stringMatching(/answerExpr: expected 41, got 42/),
    ]);
  });

  it("reports a starter that already passes every hidden test", () => {
    expect(check(exercise({ starter: "def double(x):\n    return 2 * x\n" })).errors).toEqual([
      expect.stringMatching(/starter: passes every hidden test/),
    ]);
  });

  it("reports a solution that doesn't run", () => {
    expect(check(exercise({ solutionCode: "def double(x) return 2" })).errors).toEqual([
      expect.stringMatching(/solutionCode: SyntaxError/),
    ]);
  });
});

describe("code exercise rules", () => {
  it("needs answer and answerExpr together", () => {
    expect(exerciseRuleErrors(exercise({ answer: undefined }))).toEqual([
      "answer: a code exercise has both answer and answerExpr, or neither",
    ]);
    expect(exerciseRuleErrors(exercise({ answer: undefined, answerExpr: undefined }))).toEqual([]);
  });

  it("only knows the generated datasets", () => {
    expect(() => exercise({ dataset: "ceny-gbm" })).not.toThrow();
    expect(() => exercise({ dataset: "sp500" })).toThrow();
  });
});
