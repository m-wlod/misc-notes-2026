import { describe, expect, it } from "vitest";

import { bioSource, hasUtm, landingPath, parseUtm, withoutUtm, withUtm } from "./utm";

describe("campaign params", () => {
  it("reads and normalises utm params; a source is required", () => {
    expect(parseUtm("?utm_source=TikTok&utm_medium=Social%20Bio&utm_campaign=kelly-1")).toEqual({
      source: "tiktok",
      medium: "social-bio",
      campaign: "kelly-1",
    });
    expect(parseUtm("?utm_source=youtube")).toEqual({
      source: "youtube",
      medium: "",
      campaign: "",
    });
    expect(parseUtm("?utm_medium=bio")).toBeNull();
    expect(parseUtm("?utm_source=<script>")).toBeNull();
    expect(parseUtm(`?utm_source=${"a".repeat(41)}`)).toBeNull();
    expect(parseUtm("?utm_source=x&utm_campaign=%F0%9F%92%B0")).toEqual({
      source: "x",
      medium: "",
      campaign: "",
    });
  });

  it("strips utm params and keeps the rest", () => {
    expect(hasUtm("?utm_source=x")).toBe(true);
    expect(hasUtm("?seed=7")).toBe(false);
    expect(withoutUtm("?seed=7&utm_source=x&utm_medium=y")).toBe("?seed=7");
    expect(withoutUtm("?utm_source=x")).toBe("");
  });

  it("counts paths only, never other hosts or queries", () => {
    expect(landingPath("/pl/v/kelly")).toBe("/pl/v/kelly");
    expect(landingPath("//evil.example/x")).toBeNull();
    expect(landingPath("https://evil.example/")).toBeNull();
    expect(landingPath(`/${"a".repeat(200)}`)).toBeNull();
  });

  it("builds link-in-bio links", () => {
    const utm = { source: "tiktok", medium: "link-in-bio", campaign: "bio" };
    expect(withUtm("/pl/v/kelly", utm)).toBe(
      "/pl/v/kelly?utm_source=tiktok&utm_medium=link-in-bio&utm_campaign=bio",
    );
    expect(withUtm("/pl/laboratorium?x=1", { ...utm, campaign: "" })).toBe(
      "/pl/laboratorium?x=1&utm_source=tiktok&utm_medium=link-in-bio",
    );
    expect(bioSource("youtube")).toBe("youtube");
    expect(bioSource(["instagram", "x"])).toBe("instagram");
    expect(bioSource("myspace")).toBe("bio");
    expect(bioSource(undefined)).toBe("bio");
  });
});
