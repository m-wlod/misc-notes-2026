import { describe, expect, it } from "vitest";

import { cronHealth, healthy, thresholdsCrossed } from "./rules";

describe("AI budget alerts", () => {
  it("fire once at each of 50, 80 and 100% as spend crosses them", () => {
    expect(thresholdsCrossed(0, 2, 5)).toEqual([]);
    expect(thresholdsCrossed(2, 2.5, 5)).toEqual([50]);
    expect(thresholdsCrossed(2.4, 5.1, 5)).toEqual([50, 80, 100]);
    expect(thresholdsCrossed(4, 4.5, 5)).toEqual([]); // 80 already crossed, 100 not yet
    expect(thresholdsCrossed(1, 9, 0)).toEqual([]);
  });
});

describe("cron health", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
  const ok = (job: string, h: number) => ({ job, started_at: at(h), ok: true });

  it("ok when every job ran within its interval plus grace", () => {
    const runs = [
      ok("leagues", 10),
      ok("calibrate", 9),
      ok("notify", 20),
      ok("retention", 8),
      ok("newsletter", 24 * 6),
    ];
    expect(healthy(cronHealth(runs, now))).toBe(true);
  });

  it("late, failed and never-run jobs are named", () => {
    const runs = [
      ok("leagues", 30), // 24 h + 3 h grace passed
      { job: "calibrate", started_at: at(1), ok: false },
      ok("calibrate", 20),
      ok("notify", 2),
      { job: "retention", started_at: at(0.1), ok: null }, // still running: ignored
      ok("retention", 3),
    ];
    const byJob = Object.fromEntries(cronHealth(runs, now).map((j) => [j.job, j.status]));
    expect(byJob).toEqual({
      leagues: "late",
      calibrate: "failed",
      notify: "ok",
      retention: "ok",
      newsletter: "never",
    });
  });
});
