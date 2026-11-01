import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { brief, exerciseMix, parseInboxNote } from "./draft";
import { statusTable } from "./status";

const read = (name: string) =>
  readFileSync(`src/features/content/fixtures/pipeline/inbox/${name}`, "utf8");

describe("content:draft", () => {
  it("parses a valid inbox note", () => {
    const result = parseInboxNote(read("kelly-notes.md"));
    expect("note" in result && result.note.lesson).toBe("kelly-criterion");
  });

  it("explains what is wrong with a bad note", () => {
    const result = parseInboxNote(read("bad-notes.md"));
    expect("errors" in result && result.errors).toEqual([
      expect.stringMatching(/^lesson: /),
      expect.stringMatching(/^sources: /),
    ]);
  });

  it("aims exercises around the lesson level plus one interview item", () => {
    expect(exerciseMix(3)).toEqual({ 2: 3, 3: 6, 4: 4, 5: 1 });
    expect(exerciseMix(1)).toEqual({ 1: 6, 2: 4, 5: 1 });
    expect(exerciseMix(5)).toEqual({ 4: 3, 5: 7 });
  });

  it("writes a brief with the target, the copyright rule, the mix and the notes", () => {
    const result = parseInboxNote(read("kelly-notes.md"));
    if (!("note" in result)) throw new Error("fixture invalid");
    const text = brief(result.note, {
      id: "kelly-criterion",
      title: "Kryterium Kelly'ego",
      level: 3,
      prerequisites: ["expected-value", "log-returns"],
      track: "Wartość oczekiwana i zakłady",
      module: "Zakłady i wielkość stawki",
      lessonFile: "content/pl/tracks/expected-value/betting/kelly-criterion.mdx",
      exercisesDir: "content/exercises/expected-value/kelly-criterion",
    });
    expect(text).toContain("content/pl/tracks/expected-value/betting/kelly-criterion.mdx");
    expect(text).toContain("**sources, not text to copy**");
    expect(text).toContain("14 exercises (level 2: 3, level 3: 6, level 4: 4, level 5: 1)");
    expect(text).toContain("- Przykładowa książka (fixture), ch. 3, p. 41");
    expect(text).toContain("TEST FIXTURE for `content:draft`");
  });
});

describe("content:status", () => {
  it("prints aligned rows and counts per state", () => {
    const table = statusTable([
      { kind: "lesson", id: "a", status: "draft", level: 1, detail: "pl, en · stub" },
      { kind: "exercise", id: "a-1", status: "review", level: 2, detail: "numeric" },
    ]);
    expect(table.split("\n")[1]).toMatch(/^lesson\s+a\s+draft\s+1\s+pl, en · stub$/);
    expect(table).toContain("lesson draft: 1 · exercise review: 1");
  });
});
