import { describe, expect, it } from "vitest";

import { loadExercises } from "./load";
import { internalLinks, levelReport, loadLessonSources, qa } from "./qa";

const ROOT = "src/features/content/fixtures/pipeline/qa";

describe("qa", () => {
  const lessons = loadLessonSources(ROOT);
  const { exercises } = loadExercises(ROOT);
  const result = qa({
    lessons,
    exercises,
    isPath: (p) => p === "/pl/nauka",
    moduleOf: (id) => (id === "fixture-lesson" ? "T · M" : undefined),
  });

  it("reports every problem with its file", () => {
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /fixture-lesson\.mdx: sources: a written lesson needs at least one source$/,
        ),
        expect.stringMatching(/fixture-lesson\.mdx: link: "\/pl\/nie-ma-takiej" is not a page/),
        expect.stringMatching(/bad\.yaml: hints: add at least one hint$/),
        expect.stringMatching(/bad\.yaml: solution: add a step-by-step solution$/),
        expect.stringMatching(/bad\.yaml: lessonIds: unknown lesson "ghost-lesson"$/),
      ]),
    );
    expect(result.errors).toHaveLength(5);
  });

  it("skips stubs and warns about an answer printed in its lesson", () => {
    expect(result.errors.join("\n")).not.toContain("stub-lesson");
    expect(result.warnings).toEqual([expect.stringMatching(/answer "12345" appears verbatim/)]);
  });

  it("reports the level distribution per module", () => {
    expect(levelReport(result.levels)).toEqual([
      "T · M: L1=0 L2=1 L3=0 L4=0 L5=0  (no exercises at level 1, 3, 4, 5)",
    ]);
  });

  it("finds internal links in markdown and attributes", () => {
    expect(internalLinks('[a](/pl/x#y) <a href="/en/z">b</a> [c](https://e.com)')).toEqual([
      "/pl/x",
      "/en/z",
    ]);
  });
});
