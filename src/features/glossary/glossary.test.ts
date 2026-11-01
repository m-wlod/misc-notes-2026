import { describe, expect, it } from "vitest";

import { fold, groupByInitial, matches, sortEntries, type GlossaryEntry } from "./glossary";

const entry = (name: string, extra: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
  id: name,
  name,
  otherName: "",
  definition: "",
  sample: false,
  ...extra,
});

describe("sortEntries", () => {
  it("sorts A–Z with Polish collation (ł after l, ś after s, ż last)", () => {
    const names = ["żeton", "łańcuch", "sigma", "lambda", "średnia", "zmienna", "Alfa"];
    expect(
      sortEntries(
        names.map((n) => entry(n)),
        "pl",
      ).map((e) => e.name),
    ).toEqual(["Alfa", "lambda", "łańcuch", "sigma", "średnia", "zmienna", "żeton"]);
  });
});

describe("groupByInitial", () => {
  it("keeps Ł and Ś as their own letters", () => {
    const sorted = sortEntries([entry("lambda"), entry("łańcuch"), entry("Łoś")], "pl");
    expect(groupByInitial(sorted, "pl").map((g) => [g.letter, g.entries.length])).toEqual([
      ["L", 1],
      ["Ł", 2],
    ]);
  });
});

describe("matches", () => {
  const ev = entry("wartość oczekiwana", {
    otherName: "expected value",
    definition: "Średni wynik losowego doświadczenia.",
  });

  it.each(["wartość", "WARTOSC", "  oczek ", "expected", "średni", "sredni", ""])(
    "finds %j",
    (q) => {
      expect(matches(ev, q)).toBe(true);
    },
  );

  it("rejects unrelated text", () => {
    expect(matches(ev, "wariancja")).toBe(false);
  });

  it("folds ł to l", () => {
    expect(fold("Łańcuch Markowa")).toBe("lancuch markowa");
  });
});
