import { describe, expect, it } from "vitest";

import { isInternalPath, isStyleguideEnabled, resolveSiteUrl } from "./runtime";

describe("isStyleguideEnabled", () => {
  it.each([
    [{ NODE_ENV: "development" }, true],
    [{ NODE_ENV: "production", VERCEL_ENV: "preview" }, true],
    [{ NODE_ENV: "production", ENABLE_STYLEGUIDE: "1" }, true],
    // a local or non-Vercel production build is hidden by default (review M11)
    [{ NODE_ENV: "production" }, false],
    [{}, false],
    // Vercel production always wins, even with the override or a dev NODE_ENV
    [{ NODE_ENV: "production", VERCEL_ENV: "production", ENABLE_STYLEGUIDE: "1" }, false],
    [{ NODE_ENV: "development", VERCEL_ENV: "production" }, false],
  ] as const)("%j → %s", (env, expected) => {
    expect(isStyleguideEnabled(env)).toBe(expected);
  });
});

describe("resolveSiteUrl", () => {
  it("prefers the explicit site URL", () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.pl", VERCEL_URL: "x.vercel.app" })
        .href,
    ).toBe("https://example.pl/");
  });

  it("uses the production domain on Vercel production (review L6)", () => {
    expect(
      resolveSiteUrl({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "quant.example.pl",
        VERCEL_URL: "quant-abc123.vercel.app",
      }).href,
    ).toBe("https://quant.example.pl/");
  });

  it("uses the deployment URL on previews", () => {
    expect(
      resolveSiteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "quant-git-x.vercel.app" }).href,
    ).toBe("https://quant-git-x.vercel.app/");
  });

  it("falls back to localhost only when nothing is known", () => {
    expect(resolveSiteUrl({}).href).toBe("http://localhost:3000/");
  });
});

describe("isInternalPath", () => {
  it.each([
    "/pl/styleguide",
    "/en/styleguide/",
    "/styleguide",
    "/pl/dev/content-preview",
    "/en/dev",
    "/dev/anything",
  ])("hides %s", (path) => {
    expect(isInternalPath(path)).toBe(true);
  });

  it.each(["/pl", "/pl/nauka", "/en/developers", "/pl/styleguides", "/pl/debunk", "/pl/x/dev"])(
    "leaves %s public",
    (path) => {
      expect(isInternalPath(path)).toBe(false);
    },
  );
});
