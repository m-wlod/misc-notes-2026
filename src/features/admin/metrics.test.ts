import { describe, expect, it } from "vitest";

import { cohortTable, parseRange, totals, type MetricRow } from "./metrics";

const today = new Date("2026-11-04T10:00:00Z");

describe("dashboard range", () => {
  it("defaults to the last 30 days", () => {
    expect(parseRange({}, today)).toEqual({ from: "2026-10-06", to: "2026-11-04" });
  });
  it("takes valid dates, swaps nothing, clamps a reversed or over-long range", () => {
    expect(parseRange({ od: "2026-11-01", do: "2026-11-03" }, today)).toEqual({
      from: "2026-11-01",
      to: "2026-11-03",
    });
    expect(parseRange({ od: "2026-11-05", do: "2026-11-03" }, today).from).toBe("2026-11-03");
    expect(parseRange({ od: "2020-01-01", do: "2026-11-03" }, today).from).toBe("2025-11-03");
    expect(parseRange({ od: "x'; drop", do: ["2026-11-02"] }, today)).toEqual({
      from: "2026-10-04",
      to: "2026-11-02",
    });
  });
});

describe("dashboard numbers", () => {
  const row = (day: string, a: number, w: number, s: number): MetricRow => ({
    day,
    active_users: a,
    wau: w,
    signups: s,
    lessons_completed: 1,
    attempts: 2,
  });
  it("today's DAU/WAU come from the last day; the rest are sums", () => {
    expect(totals([row("2026-11-01", 3, 5, 1), row("2026-11-02", 2, 6, 2)])).toEqual({
      dau: 2,
      wau: 6,
      signups: 3,
      lessons: 2,
      attempts: 4,
    });
    expect(totals([])).toEqual({ dau: 0, wau: 0, signups: 0, lessons: 0, attempts: 0 });
  });
  it("cohorts become shares per week; weeks not reached stay empty", () => {
    expect(
      cohortTable(
        [
          { cohort: "2026-10-26", size: 4, week: 0, active: 4 },
          { cohort: "2026-10-26", size: 4, week: 1, active: 1 },
          { cohort: "2026-11-02", size: 2, week: 0, active: 1 },
        ],
        2,
      ),
    ).toEqual([
      { cohort: "2026-10-26", size: 4, shares: [1, 0.25, null] },
      { cohort: "2026-11-02", size: 2, shares: [0.5, null, null] },
    ]);
  });
});
