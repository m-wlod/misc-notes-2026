import { describe, expect, it } from "vitest";

import { isVisible } from "./visibility";

describe("isVisible", () => {
  it.each([
    ["published", false, true],
    ["draft", false, false], // production: samples and drafts stay hidden
    ["review", false, false],
    ["draft", true, true], // internal pages: everything, for review
  ] as const)("%s, internal=%s → %s", (status, internal, expected) => {
    expect(isVisible({ status }, internal)).toBe(expected);
  });
});
