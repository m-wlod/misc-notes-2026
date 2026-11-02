import { describe, expect, it } from "vitest";

import { memoryLimiter } from "./rate-limit";

describe("memoryLimiter", () => {
  it("allows up to the limit per window, per key, then recovers", () => {
    const limiter = memoryLimiter({ limit: 3, windowMs: 1000 });
    expect([0, 10, 20, 30].map((t) => limiter.hit("a", t))).toEqual([true, true, true, false]);
    expect(limiter.hit("b", 30)).toBe(true);
    expect(limiter.hit("a", 1001)).toBe(true); // the first hit left the window
  });
});
