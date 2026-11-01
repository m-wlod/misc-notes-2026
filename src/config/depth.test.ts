import { describe, expect, it } from "vitest";

import { DEPTH_SCRIPT, DEPTH_STORAGE_KEY, pickDepth } from "./depth";

describe("pickDepth", () => {
  it.each([
    ["formal", "formal"],
    ["easy", "easy"],
    [null, "easy"],
    ["hacked", "easy"],
  ] as const)("%s → %s", (stored, expected) => {
    expect(pickDepth(stored)).toBe(expected);
  });
});

describe("DEPTH_SCRIPT", () => {
  const run = (getItem: () => string | null) => {
    const html = { dataset: {} as Record<string, string> };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const script = new Function("localStorage", "document", DEPTH_SCRIPT) as (
      storage: { getItem: () => string | null },
      doc: { documentElement: typeof html },
    ) => void;
    script({ getItem }, { documentElement: html });
    return html.dataset.depth;
  };

  it("applies the stored depth and falls back to easy", () => {
    expect(run(() => "formal")).toBe("formal");
    expect(run(() => "nonsense")).toBe("easy");
    expect(run(() => null)).toBe("easy");
  });

  it("survives storage that throws (private mode)", () => {
    expect(
      run(() => {
        throw new Error("denied");
      }),
    ).toBe("easy");
  });

  it("reads the shared storage key", () => {
    expect(DEPTH_SCRIPT).toContain(JSON.stringify(DEPTH_STORAGE_KEY));
  });
});
