import { describe, expect, it } from "vitest";

import { localeOfPath, safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/pl/profil", "/en/profile", "/pl", "/en/learn?tab=map", "/pl/pierwsze-kroki"])(
    "allows %s",
    (next) => {
      expect(safeNext(next, "/pl")).toBe(next);
    },
  );

  it.each([
    null,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/pl//evil.com",
    "javascript:alert(1)",
    "/de/profil",
    "profil",
    "/pl/<script>",
    "/pl/profil#frag",
  ])("rejects %j", (next) => {
    expect(safeNext(next, "/pl")).toBe("/pl");
  });
});

describe("localeOfPath", () => {
  it("reads the prefix", () => {
    expect(localeOfPath("/en/profile")).toBe("en");
    expect(localeOfPath("/pl/profil")).toBe("pl");
    expect(localeOfPath("/anything")).toBe("pl");
  });
});
