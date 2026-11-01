import { describe, expect, it } from "vitest";

import type { SearchDoc } from "./docs";
import { createSearchIndex, tokenizer } from "./engine";

const doc = (
  id: string,
  title: string,
  text = "",
  type: SearchDoc["type"] = "lesson",
): SearchDoc => ({
  id,
  type,
  title,
  context: "",
  text,
  url: `/pl/x#${id}`,
});

const docs = [
  doc("dist", "Zmienne losowe i rozkłady", "Rozkład dwumianowy i normalny."),
  doc("chain", "Łańcuchy Markowa", "Przejścia między stanami."),
  doc("kelly", "Kryterium Kelly'ego", "Jaką część kapitału stawiać."),
  doc("ev-term", "wartość oczekiwana", "Średni wynik.", "term"),
  doc("var", "Wariancja wyników", "Ryzyko a wartość oczekiwana."),
];

describe("tokenizer", () => {
  it("folds case and Polish diacritics, splitting on punctuation", () => {
    expect(tokenizer.tokenize("Rozkład, ŁAŃCUCH; Kelly'ego")).toEqual([
      "rozklad",
      "lancuch",
      "kelly",
      "ego",
    ]);
  });
});

describe("search", () => {
  it.each([
    ["rozklad", "dist"],
    ["rozkłady", "dist"],
    ["lancuch", "chain"],
    ["kelly", "kelly"],
    ["KELLY", "kelly"],
  ])("%j finds %s", async (term, id) => {
    const query = await createSearchIndex(docs);
    expect((await query(term)).map((h) => h.id)).toContain(id);
  });

  it("ranks a title match above a body match", async () => {
    const query = await createSearchIndex(docs);
    const ids = (await query("wartosc oczekiwana")).map((h) => h.id);
    expect(ids[0]).toBe("ev-term");
    expect(ids).toContain("var");
  });

  it("requires every word and ignores empty queries", async () => {
    const query = await createSearchIndex(docs);
    expect(await query("rozklad kelly")).toEqual([]);
    expect(await query("  ,; ")).toEqual([]);
  });
});
