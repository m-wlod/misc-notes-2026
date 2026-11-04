import { describe, expect, it } from "vitest";

import { LEAGUE } from "./config";
import { grid, parseDaily, shareParams, shareQuery, withAttempt } from "./daily";
import { isTimeZone, localDate } from "./days";
import { joinGroup, tierOnReturn } from "./league";
import { recommend } from "./rating";
import { replayStreak } from "./streak";
import { xpKey } from "./xp";

/** Edge cases of XP, streaks, leagues and ratings (Phase 20 coverage pass). */
describe("leagues: edges", () => {
  it("a returning learner keeps the tier unless last week demoted them", () => {
    const split = LEAGUE.splitThreshold;
    expect(tierOnReturn({ tier: 3, finalRank: null, groupSize: 30, weekActive: split })).toBe(3);
    expect(tierOnReturn({ tier: 3, finalRank: 30, groupSize: 30, weekActive: 10 })).toBe(3);
    expect(tierOnReturn({ tier: 3, finalRank: 30, groupSize: 30, weekActive: split })).toBe(2);
    expect(tierOnReturn({ tier: 1, finalRank: 30, groupSize: 30, weekActive: split })).toBe(1);
    expect(tierOnReturn({ tier: 3, finalRank: 1, groupSize: 30, weekActive: split })).toBe(3);
  });

  it("mid-week joins pick the smallest open group, ties to the lower id, else a new one", () => {
    expect(joinGroup(new Map(), "split")).toBe(1);
    expect(joinGroup(new Map([[1, 5]]), "shared")).toBe(1);
    expect(
      joinGroup(
        new Map([
          [3, 10],
          [2, 10],
          [1, 29],
        ]),
        "split",
      ),
    ).toBe(2);
    expect(
      joinGroup(
        new Map([
          [1, 30],
          [2, 30],
        ]),
        "split",
      ),
    ).toBe(3);
  });
});

describe("rating: edges", () => {
  it("nothing to recommend once everything is solved; unrated learners get any topic", () => {
    const ex = [{ id: "a", level: 1, topics: ["p"] }];
    expect(recommend(new Map(), ex, new Set(["a"]))).toBeNull();
    expect(recommend(new Map(), ex, new Set())?.id).toBe("a");
  });

  it("the weakest rated topic wins; ties break by level, then id", () => {
    const ex = [
      { id: "b", level: 1, topics: ["weak"] },
      { id: "a", level: 1, topics: ["weak"] },
      { id: "c", level: 1, topics: ["strong"] },
    ];
    const ratings = new Map([
      ["strong", 1400],
      ["weak", 900],
      ["empty", 800],
    ]);
    expect(recommend(ratings, ex, new Set())?.id).toBe("a");
  });

  it("an unrated topic counts at the starting rating", () => {
    const ex = [
      { id: "hard", level: 5, topics: ["new"] },
      { id: "fit", level: 1, topics: ["new"] },
    ];
    expect(recommend(new Map([["other", 1200]]), ex, new Set())?.id).toBe("fit");
  });
});

describe("streak: edges", () => {
  it("a freeze covers one missed day", () => {
    const week = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"];
    const goals = [...week, "2026-01-06", "2026-01-07", "2026-01-09"];
    const s = replayStreak(goals, [], "2026-01-09");
    expect(s.freezesUsed).toBe(1);
    expect(s.current).toBe(8);
  });

  it("a second missed day is too late to repair", () => {
    const s = replayStreak(["2026-01-01", "2026-01-02"], [], "2026-01-05");
    expect(s.current).toBe(0);
    expect(s.repairable).toBeNull();
    expect(s.longest).toBe(2);
  });

  it("the day after a break can still be repaired", () => {
    const s = replayStreak(["2026-01-01", "2026-01-02"], [], "2026-01-04");
    expect(s.repairable).toEqual({ lost: 2 });
  });
});

describe("daily problems: edges", () => {
  it("corrupt storage starts fresh; a solved problem takes no more attempts", () => {
    expect(parseDaily("{not json")).toEqual({ version: 1, days: {} });
    expect(parseDaily(JSON.stringify({ version: 9 }))).toEqual({ version: 1, days: {} });
    const once = withAttempt(null, "2026-01-01:1", "e", true, 0);
    expect(withAttempt(once, "2026-01-01:1", "e", false, 3)).toBe(once);
  });

  it("keeps the newest 150 days, oldest dropped", () => {
    let raw: string | null = null;
    for (let i = 0; i < 152; i++) {
      const day = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      raw = withAttempt(raw, `${day}:1`, "e", false, 0);
    }
    const days = Object.keys(parseDaily(raw).days);
    expect(days).toHaveLength(150);
    expect(days[0]).toBe("2026-01-03:1");
  });

  it("the share grid and query round-trip through the strict params", () => {
    expect(grid(["x", "x", "o"])).toBe("🟥🟥🟩");
    const p = shareParams.parse({ d: "2026-01-01", l: "2", r: "xo", h: "1" });
    expect(shareParams.parse(Object.fromEntries(new URLSearchParams(shareQuery(p))))).toEqual(p);
  });
});

describe("days and XP keys: edges", () => {
  it("an unknown time zone falls back to the league zone", () => {
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    const t = Date.UTC(2026, 0, 1, 23, 30);
    expect(localDate(t, "Mars/Olympus")).toBe(localDate(t, LEAGUE.timeZone));
  });

  it("a content correction earns XP once per report", () => {
    expect(xpKey.correction(12)).toBe("correction:12");
  });
});
