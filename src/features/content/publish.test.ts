import { describe, expect, it } from "vitest";

import { showsBody } from "./publish";

describe("showsBody (review workflow)", () => {
  it.each([
    ["published", false, false, true],
    ["review", false, false, false],
    ["draft", false, false, false],
    ["draft", false, true, true], // internal preview shows drafts for review
    ["published", true, true, false], // a stub never has a body to show
  ] as const)("%s, stub=%s, preview=%s → %s", (status, isStub, preview, expected) => {
    expect(showsBody({ status, isStub }, preview)).toBe(expected);
  });
});
