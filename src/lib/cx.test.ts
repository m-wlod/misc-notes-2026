import { describe, expect, it } from "vitest";

import { cx } from "./cx";

describe("cx", () => {
  it("skips falsy values", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });

  it("lets a later utility override an earlier conflicting one (review M2)", () => {
    expect(cx("w-full", "w-40")).toBe("w-40");
    expect(cx("mb-4", "mb-0")).toBe("mb-0");
    expect(cx("font-medium", "font-normal")).toBe("font-normal");
  });

  it("treats the custom type scale as font sizes, not colours", () => {
    expect(cx("text-reading", "text-ink")).toBe("text-reading text-ink");
    expect(cx("text-2xs", "text-ink-muted")).toBe("text-2xs text-ink-muted");
    expect(cx("text-sm", "text-reading")).toBe("text-reading");
  });

  it("keeps different token colours on different properties", () => {
    expect(cx("bg-surface", "text-ink", "border-rule-strong")).toBe(
      "bg-surface text-ink border-rule-strong",
    );
    expect(cx("bg-surface", "bg-sunken")).toBe("bg-sunken");
  });
});
