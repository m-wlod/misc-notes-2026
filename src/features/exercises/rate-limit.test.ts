import { describe, expect, it } from "vitest";

import { memoryKV } from "@/lib/kv/store";

import { kvLimiter, memoryLimiter } from "./rate-limit";

describe("memoryLimiter", () => {
  it("allows up to the limit per window, per key, then recovers", () => {
    const limiter = memoryLimiter({ limit: 3, windowMs: 1000 });
    expect([0, 10, 20, 30].map((t) => limiter.hit("a", t))).toEqual([true, true, true, false]);
    expect(limiter.hit("b", 30)).toBe(true);
    expect(limiter.hit("a", 1001)).toBe(true); // the first hit left the window
  });
});

describe("kvLimiter (shared store, e.g. Upstash)", () => {
  it("allows `limit` calls per window and key", async () => {
    let now = 0;
    const kv = memoryKV(() => now);
    const limiter = kvLimiter(kv, { limit: 2, windowMs: 1000, prefix: "t" });
    expect([
      await limiter.hit("a", 0),
      await limiter.hit("a", 10),
      await limiter.hit("a", 20),
    ]).toEqual([true, true, false]);
    expect(await limiter.hit("b", 20)).toBe(true);
    now = 1500;
    expect(await limiter.hit("a", 1500)).toBe(true); // a new window
  });
});
