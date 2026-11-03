import { describe, expect, it } from "vitest";

import { MIN_ATTEMPTS } from "@/features/grading/calibrate";

import {
  contentRows,
  countTodos,
  filterRows,
  summarize,
  type ContentInput,
} from "./content-status";

const input: ContentInput = {
  lessons: [
    { id: "ev", locale: "pl", title: "Wartość oczekiwana", status: "published", file: "pl/ev.mdx" },
    { id: "ev", locale: "en", title: "Expected value", status: "published", file: "en/ev.mdx" },
    { id: "var", locale: "pl", title: "Wariancja", status: "draft", file: "pl/var.mdx" },
  ],
  exercises: [
    {
      id: "ex-easy",
      level: 4,
      status: "review",
      lessonIds: ["ev"],
      promptPl: "Ile?",
      hasEn: true,
      file: "ex/easy.yaml",
    },
    {
      id: "ex-ok",
      level: 1,
      status: "draft",
      lessonIds: [],
      promptPl: "x".repeat(200),
      hasEn: false,
      file: "ex/ok.yaml",
    },
  ],
  debunk: [{ id: "guru", locale: "pl", claim: "Teza", status: "draft", file: "pl/guru.mdx" }],
  trackOf: new Map([["ev", "probability"]]),
  todos: { "pl/ev.mdx": 1, "en/ev.mdx": 2, "ex/ok.yaml": 1 },
  stats: [
    { exerciseId: "ex-easy", attempts: MIN_ATTEMPTS, successRate: 0.95, medianTimeMs: null },
    { exerciseId: "ex-ok", attempts: MIN_ATTEMPTS, successRate: 0.9, medianTimeMs: null },
  ],
};

describe("content status", () => {
  const rows = contentRows(input);
  const row = (id: string) => rows.find((r) => r.id === id);

  it("one row per item, with English, TODO markers from every locale, track and calibration", () => {
    expect(rows.map((r) => `${r.kind}:${r.id}`)).toEqual([
      "lesson:ev",
      "lesson:var",
      "exercise:ex-easy",
      "exercise:ex-ok",
      "debunk:guru",
    ]);
    expect(row("ev")).toMatchObject({ missingEn: false, todos: 3, track: "probability" });
    expect(row("var")).toMatchObject({ missingEn: true, todos: 0, track: null });
    expect(row("ex-easy")).toMatchObject({ calibration: "too-easy", track: "probability" });
    expect(row("ex-ok")).toMatchObject({ calibration: null, missingEn: true, todos: 1 });
    expect(row("ex-ok")?.title.length).toBeLessThanOrEqual(80);
    expect(row("guru")).toMatchObject({ kind: "debunk", missingEn: true });
  });

  it("filters and totals", () => {
    expect(filterRows(rows, { kind: "lesson" }).map((r) => r.id)).toEqual(["ev", "var"]);
    expect(filterRows(rows, { status: "draft" }).map((r) => r.id)).toEqual([
      "var",
      "ex-ok",
      "guru",
    ]);
    expect(filterRows(rows, { track: "probability" }).map((r) => r.id)).toEqual(["ev", "ex-easy"]);
    expect(filterRows(rows, { attention: true }).map((r) => r.id)).toEqual([
      "ev",
      "var",
      "ex-easy",
      "ex-ok",
      "guru",
    ]);
    expect(summarize(rows)).toEqual({
      draft: 3,
      review: 1,
      published: 1,
      missingEn: 3,
      todos: 4,
      flagged: 1,
    });
  });

  it("counts TODO(verify) markers", () => {
    expect(countTodos("a TODO(verify) b TODO(verify)\nTODO(later) TODO verify")).toBe(2);
    expect(countTodos("")).toBe(0);
  });
});
