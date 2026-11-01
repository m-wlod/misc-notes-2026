import { describe, expect, it } from "vitest";

import { checkCatalogs, flatten, placeholders } from "./check-i18n";

const pl = {
  nav: { learn: "Nauka", count: "{count, plural, one {# lekcja} few {# lekcje} other {# lekcji}}" },
};

describe("placeholders", () => {
  it("finds simple and formatted arguments", () => {
    expect(placeholders("Etap {phase} z {total, number}")).toEqual(["phase", "total"]);
  });
  it("finds the plural argument but not branch keywords", () => {
    expect(placeholders("{count, plural, one {# lekcja} other {# lekcji}}")).toEqual(["count"]);
  });
  it("finds arguments nested inside plural branches", () => {
    expect(
      placeholders("{n, plural, one {{name} ma # punkt} other {{name} ma # punktów}}"),
    ).toEqual(["n", "name"]);
  });
  it("ignores quoted ICU literals", () => {
    expect(placeholders("Użyj '{nawiasów}' dosłownie, {x}")).toEqual(["x"]);
  });
});

describe("flatten", () => {
  it("joins nested keys with dots", () => {
    expect([...flatten({ a: { b: "x", c: { d: "y" } } }).keys()]).toEqual(["a.b", "a.c.d"]);
  });
});

describe("checkCatalogs", () => {
  it("passes identical structures", () => {
    const en = {
      nav: { learn: "Learn", count: "{count, plural, one {# lesson} other {# lessons}}" },
    };
    expect(checkCatalogs({ pl, en }, "pl")).toEqual([]);
  });

  it("reports missing and extra keys", () => {
    const en = { nav: { learn: "Learn", extra: "x" } };
    expect(checkCatalogs({ pl, en }, "pl")).toEqual([
      { locale: "en", key: "nav.count", message: "missing key" },
      { locale: "en", key: "nav.extra", message: "extra key (not in pl)" },
    ]);
  });

  it("reports placeholder mismatches", () => {
    const en = { nav: { learn: "Learn", count: "{n, plural, one {# lesson} other {# lessons}}" } };
    expect(checkCatalogs({ pl, en }, "pl")).toEqual([
      { locale: "en", key: "nav.count", message: "placeholders {n} differ from pl {count}" },
    ]);
  });

  it("reports empty strings and missing files", () => {
    const plWithErrors = { ...pl, errors: { title: "Błąd" } };
    const en = { nav: { learn: " ", count: "{count, plural, other {# lessons}}" } };
    expect(checkCatalogs({ pl: plWithErrors, en }, "pl")).toEqual([
      { locale: "en", key: "nav.learn", message: "empty string" },
      { locale: "en", key: "errors", message: "missing file errors.json" },
      { locale: "en", key: "errors.title", message: "missing key" },
    ]);
  });
});
