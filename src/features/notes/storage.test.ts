import { describe, expect, it } from "vitest";

import {
  findQuote,
  parseNotes,
  quoteAt,
  withBookmark,
  withHighlight,
  withNote,
  withoutHighlight,
} from "./storage";

const now = new Date("2026-11-01T12:00:00Z");

describe("notes state", () => {
  it("stores a note, a bookmark and highlights per lesson", () => {
    let raw = withNote(null, "a", "Wróć do tego.", now);
    raw = withBookmark(raw, "a", true, now);
    raw = withHighlight(raw, "a", { id: "h1", exact: "x", prefix: "", suffix: "" }, now);
    const a = parseNotes(raw).lessons.a;
    expect(a).toMatchObject({ note: "Wróć do tego.", bookmarked: true });
    expect(a?.highlights.map((h) => h.id)).toEqual(["h1"]);
  });

  it("ignores a duplicate highlight and removes one by id", () => {
    const h = { id: "h1", exact: "wariancja", prefix: "służy ", suffix: "." };
    let raw = withHighlight(null, "a", h, now);
    raw = withHighlight(raw, "a", { ...h, id: "h2" }, now);
    expect(parseNotes(raw).lessons.a?.highlights).toHaveLength(1);
    raw = withoutHighlight(raw, "a", "h1", now);
    expect(parseNotes(raw).lessons.a).toBeUndefined(); // nothing left → dropped
  });

  it("drops a lesson whose note is cleared and that has nothing else", () => {
    const raw = withNote(withNote(null, "a", "x", now), "a", "   ", now);
    expect(parseNotes(raw).lessons).toEqual({});
  });

  it.each([
    "{",
    JSON.stringify({ version: 2, lessons: {} }),
    JSON.stringify({ version: 1, lessons: { a: { note: 5 } } }),
  ])("treats %j as empty", (raw) => {
    expect(parseNotes(raw).lessons).toEqual({});
  });
});

describe("text quotes", () => {
  const text = "Średnia to jedno. Wariancja to drugie. Wariancja mierzy rozrzut wyników.";

  it("round-trips a selection", () => {
    const start = text.lastIndexOf("Wariancja");
    const q = quoteAt(text, start, start + 9);
    expect(findQuote(text, q)).toBe(start);
  });

  it("picks the right copy of a repeated phrase by its context", () => {
    const second = text.lastIndexOf("Wariancja");
    expect(findQuote(text, quoteAt(text, second, second + 9))).toBe(second);
    const first = text.indexOf("Wariancja");
    expect(findQuote(text, quoteAt(text, first, first + 9))).toBe(first);
  });

  it("survives an edit elsewhere and reports a quote that is gone", () => {
    const q = quoteAt(text, text.lastIndexOf("mierzy"), text.lastIndexOf("mierzy") + 6);
    const edited = `Nowe zdanie na początku. ${text}`;
    expect(findQuote(edited, q)).toBe(edited.lastIndexOf("mierzy"));
    expect(findQuote("Inny tekst.", q)).toBe(-1);
  });
});
