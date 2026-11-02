import { describe, expect, it } from "vitest";

import { loadExercises } from "@/features/content/pipeline/load";

import { applyFilters, nextInSet, parseFilters, toQuery } from "./filter";

const all = loadExercises("content").exercises.map((e) => e.exercise);
const trackOf = (lesson: string) =>
  lesson === "przyklad-wartosc-oczekiwana" ? "samples" : undefined;

describe("parseFilters", () => {
  it("keeps valid values and drops the rest", () => {
    expect(
      parseFilters({
        level: "2",
        type: "multi",
        track: "foundations",
        topic: "przyklad",
        lesson: "kelly-criterion",
      }),
    ).toEqual({
      level: 2,
      type: "multi",
      track: "foundations",
      topic: "przyklad",
      lesson: "kelly-criterion",
    });
    expect(
      parseFilters({ level: "9", type: "hack", track: "../x", topic: "<b>", lesson: ["a b"] }),
    ).toEqual({});
    expect(parseFilters({ level: ["3", "4"] })).toEqual({ level: 3 });
  });
});

describe("applyFilters", () => {
  it("filters by level, type, topic, lesson and track", () => {
    expect(applyFilters(all, {}, trackOf)).toHaveLength(all.length);
    expect(applyFilters(all, { level: 2 }, trackOf).map((e) => e.level)).toEqual([2, 2, 2, 2]);
    expect(applyFilters(all, { type: "choice" }, trackOf).map((e) => e.id)).toEqual([
      "przyklad-wybor",
    ]);
    expect(applyFilters(all, { lesson: "przyklad-wartosc-oczekiwana" }, trackOf)).toHaveLength(
      all.length,
    );
    expect(applyFilters(all, { track: "foundations" }, trackOf)).toEqual([]);
    expect(applyFilters(all, { topic: "nope" }, trackOf)).toEqual([]);
  });
});

describe("toQuery / nextInSet", () => {
  it("serialises in a stable order", () => {
    expect(toQuery({ type: "multi", level: 1 })).toBe("?level=1&type=multi");
    expect(toQuery({})).toBe("");
    expect(toQuery({ level: 1 }, { v: "2" })).toBe("?level=1&v=2");
  });

  it("wraps to the first exercise and is null for a single one", () => {
    const set = applyFilters(all, { level: 2 }, trackOf);
    const last = set.at(-1);
    if (!last) throw new Error("no samples");
    expect(nextInSet(set, last.id)?.id).toBe(set[0]?.id);
    expect(nextInSet(set.slice(0, 1), last.id)).toBeNull();
  });
});
