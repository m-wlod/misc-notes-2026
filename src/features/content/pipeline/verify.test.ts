import { describe, expect, it } from "vitest";

import { loadExercises } from "./load";
import { compare, harness, verifyExercises, type Runner } from "./verify";

const ROOT = "src/features/content/fixtures/pipeline";
const load = (name: string) => loadExercises(`${ROOT}/${name}`);

describe("loadExercises", () => {
  it("loads valid exercises of several types", () => {
    const { exercises, errors } = load("valid");
    expect(errors).toEqual([]);
    expect(exercises.map((e) => e.exercise.type).sort()).toEqual([
      "choice",
      "numeric",
      "numeric",
      "symbolic",
    ]);
  });

  it("requires verify for computed answers", () => {
    expect(load("no-verify").errors).toEqual([
      expect.stringMatching(/bare\.yaml: verify: a numeric exercise needs a Python verify block/),
    ]);
  });
});

describe("verifyExercises with real Python", { timeout: 60_000 }, () => {
  it("passes the valid set (including a seeded simulation and an expression)", () => {
    const result = verifyExercises(load("valid").exercises);
    expect(result.errors).toEqual([]);
    expect(result.checked).toBe(3);
  });

  it.each([
    ["wrong-answer", /sum\.yaml: verify: expected 6, got 5 \(tolerance 0\)/],
    ["raises", /boom\.yaml: verify: python error: ZeroDivisionError/],
    ["unseeded", /sim\.yaml: verify: uses randomness but params has no "seed"/],
    ["timeout", /loop\.yaml: verify: timed out after 10 s/],
  ])("%s fails with a readable message", (name, message) => {
    expect(verifyExercises(load(name).exercises).errors).toEqual([expect.stringMatching(message)]);
  });
});

describe("harness and compare", () => {
  it("exposes params as variables and prints the result", () => {
    const fake: Runner = (program) => ({ ok: true, stdout: program });
    expect(harness("result = a * 2", { a: 3 })).toContain("result = a * 2");
    expect(verifyExercises([], fake)).toEqual({ checked: 0, errors: [] });
  });

  it("compares numbers within tolerance and expressions ignoring spacing", () => {
    const num = load("valid").exercises.find((e) => e.exercise.id === "seeded")?.exercise;
    const expr = load("valid").exercises.find((e) => e.exercise.id === "expr")?.exercise;
    if (!num || !expr) throw new Error("fixtures missing");
    expect(compare(num, 0.54)).toBeNull();
    expect(compare(num, 0.56)).toMatch(/expected 0.5, got 0.56/);
    expect(compare(num, "0.5")).toMatch(/expected a number/);
    expect(compare(expr, "2 * X")).toBeNull();
    expect(compare(expr, "x + x")).toMatch(/expected 2\*x/);
  });
});
