import { describe, expect, it } from "vitest";

import { curriculumRoute } from "./slug-redirect";

describe("curriculumRoute", () => {
  it.each([
    ["/en/learn/fundamenty", "/en/learn/foundations"],
    ["/pl/nauka/foundations", "/pl/nauka/fundamenty"],
    ["/en/learn/fundamenty/stopy-zwrotu", "/en/learn/foundations/returns"],
    ["/pl/nauka/fundamenty/returns", "/pl/nauka/fundamenty/stopy-zwrotu"],
    ["/en/learn/foundations/stopy-zwrotu/", "/en/learn/foundations/returns"],
    [
      "/en/learn/expected-value/betting/kryterium-kelly",
      "/en/learn/expected-value/betting/kelly-criterion",
    ],
    [
      "/pl/nauka/expected-value/betting/kelly-criterion",
      "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly",
    ],
  ])("%s → %s", (from, to) => {
    expect(curriculumRoute(from)).toEqual({ redirect: to });
  });

  it.each([
    "/pl/nauka/nie-ma-takiego",
    "/en/learn/foundations/no-such-module",
    "/pl/nauka/wartosc-oczekiwana/zaklady/nie-ma-takiej-lekcji",
    // A real lesson, but in another module.
    "/pl/nauka/wartosc-oczekiwana/zaklady/procenty-i-procent-skladany",
  ])("marks %s as missing (a real 404)", (path) => {
    expect(curriculumRoute(path)).toBe("missing");
  });

  it.each([
    "/pl/nauka/fundamenty",
    "/en/learn/foundations/returns",
    "/pl/nauka",
    "/pl/praktyka/fundamenty",
    "/en/nauka/fundamenty",
    "/pl/nauka/wartosc-oczekiwana/zaklady/kryterium-kelly",
    "/pl/nauka/a/b/c/d",
  ])("leaves %s alone", (path) => {
    expect(curriculumRoute(path)).toBeNull();
  });
});
