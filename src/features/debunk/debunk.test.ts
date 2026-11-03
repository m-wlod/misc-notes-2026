import { describe, expect, it } from "vitest";

import { applyDebunkFilters, parseDebunkFilters } from "./filters";
import { claimInput, correctionInput, submit, type Writer } from "./submit";
import { validateDebunk, type EntryRef } from "./validate";

const entry = (over: Partial<EntryRef> = {}): EntryRef => ({
  id: "skutecznosc",
  slug: "skutecznosc-90",
  locale: "pl",
  file: "content/pl/debunk/skutecznosc.mdx",
  relatedLessons: ["kelly-criterion"],
  ...over,
});

describe("entry rules", () => {
  const lessons = new Set(["kelly-criterion"]);

  it("a valid pair passes", () => {
    expect(
      validateDebunk(
        [
          entry(),
          entry({ locale: "en", slug: "win-rate-90", file: "content/en/debunk/skutecznosc.mdx" }),
        ],
        lessons,
      ),
    ).toEqual([]);
  });

  it("duplicate ids and slugs, wrong folders, orphan translations, unknown lessons", () => {
    const errors = validateDebunk(
      [
        entry(),
        entry({ file: "content/pl/debunk/copy.mdx" }),
        entry({ id: "inne", file: "content/en/debunk/inne.mdx" }),
        entry({
          id: "sierota",
          locale: "en",
          slug: "orphan",
          file: "content/en/debunk/sierota.mdx",
        }),
        entry({
          id: "lekcja",
          slug: "lekcja",
          file: "content/pl/debunk/lekcja.mdx",
          relatedLessons: ["ghost"],
        }),
      ],
      lessons,
    );
    expect(errors).toEqual([
      expect.stringMatching(/copy\.mdx: id: "skutecznosc" is already used/),
      expect.stringMatching(/copy\.mdx: slug: "skutecznosc-90" is already used/),
      expect.stringMatching(/inne\.mdx: slug: "skutecznosc-90" is already used/),
      expect.stringMatching(/inne\.mdx: locale: "pl" but the file is in content\/en\//),
      expect.stringMatching(/sierota\.mdx: id: no Polish entry with id "sierota"/),
      expect.stringMatching(/lekcja\.mdx: relatedLessons: no lesson "ghost"/),
    ]);
  });
});

describe("index filters", () => {
  const cats = ["indicators", "backtests"] as const;
  const verdicts = ["false", "misleading"] as const;

  it("known values only; arrays take the first", () => {
    expect(
      parseDebunkFilters({ kategoria: "indicators", werdykt: "false" }, cats, verdicts),
    ).toEqual({
      category: "indicators",
      verdict: "false",
    });
    expect(
      parseDebunkFilters({ kategoria: "<script>", werdykt: ["misleading", "x"] }, cats, verdicts),
    ).toEqual({
      verdict: "misleading",
    });
    expect(parseDebunkFilters({}, cats, verdicts)).toEqual({});
  });

  it("filters by category and verdict", () => {
    const list = [
      { id: "a", category: "indicators", verdict: "false" },
      { id: "b", category: "backtests", verdict: "false" },
      { id: "c", category: "indicators", verdict: "misleading" },
    ];
    expect(applyDebunkFilters(list, { category: "indicators" }).map((e) => e.id)).toEqual([
      "a",
      "c",
    ]);
    expect(
      applyDebunkFilters(list, { category: "indicators", verdict: "false" }).map((e) => e.id),
    ).toEqual(["a"]);
    expect(applyDebunkFilters(list, {})).toHaveLength(3);
  });
});

describe("moderated submissions", () => {
  const rows: [Record<string, unknown>, string | null][] = [];
  const writer: Writer = {
    insert: (row, userId) => {
      rows.push([row, userId]);
      return Promise.resolve(true);
    },
  };
  const parseClaim = (input: unknown) => () => {
    const p = claimInput.safeParse(input);
    return p.success
      ? ({
          success: true,
          row: { claim: p.data.claim, source_url: p.data.sourceUrl },
          honeypot: p.data.website,
        } as const)
      : ({ success: false } as const);
  };
  const deps = { writer, userId: null, allowed: () => Promise.resolve(true) };

  it("validates the claim and the optional link", async () => {
    expect(await submit(parseClaim({ claim: "za krótko", sourceUrl: "" }), deps)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(
      await submit(
        parseClaim({ claim: "Ten wskaźnik ma 95% trafności", sourceUrl: "javascript:alert(1)" }),
        deps,
      ),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await submit(parseClaim({ claim: "Ten wskaźnik ma 95% trafności", sourceUrl: "" }), deps),
    ).toEqual({ ok: true });
    expect(rows.at(-1)).toEqual([
      { claim: "Ten wskaźnik ma 95% trafności", source_url: null },
      null,
    ]);
  });

  it("a filled honeypot looks like success and writes nothing", async () => {
    const before = rows.length;
    expect(
      await submit(
        parseClaim({
          claim: "Ten wskaźnik ma 95% trafności",
          sourceUrl: "",
          website: "spam.example",
        }),
        deps,
      ),
    ).toEqual({ ok: true });
    expect(rows.length).toBe(before);
  });

  it("no database and rate limits are reported honestly", async () => {
    const claim = { claim: "Ten wskaźnik ma 95% trafności", sourceUrl: "https://example.com/post" };
    expect(await submit(parseClaim(claim), { ...deps, writer: null })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(
      await submit(parseClaim(claim), { ...deps, allowed: () => Promise.resolve(false) }),
    ).toEqual({
      ok: false,
      reason: "rate-limited",
    });
  });

  it("corrections need a real entry id and a body", () => {
    expect(
      correctionInput.safeParse({
        entryId: "przyklad-skutecznosc",
        body: "Liczba w przykładzie jest zła.",
      }).success,
    ).toBe(true);
    expect(
      correctionInput.safeParse({ entryId: "../etc", body: "Liczba w przykładzie jest zła." })
        .success,
    ).toBe(false);
    expect(correctionInput.safeParse({ entryId: "x", body: "krótko" }).success).toBe(false);
  });
});
