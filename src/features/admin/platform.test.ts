import { describe, expect, it } from "vitest";

import { aiSettingsSchema, withSettings } from "@/features/ai-grading/quota";

import {
  announcementState,
  bucketOf,
  flagOn,
  liveAnnouncements,
  warsawLocalToIso,
} from "./platform";

describe("feature flag rollout", () => {
  const ids = Array.from(
    { length: 2000 },
    (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  );

  it("is deterministic per user and flag", () => {
    for (const id of ids.slice(0, 20))
      expect(bucketOf("nowy-quiz", id)).toBe(bucketOf("nowy-quiz", id));
  });

  it("lets in about the rollout share, and a larger share keeps everyone already in", () => {
    const on = (p: number) =>
      ids.filter((id) => flagOn({ enabled: true, rollout_percent: p }, "f", id));
    const ten = on(10);
    const fifty = on(50);
    expect(ten.length / ids.length).toBeGreaterThan(0.07);
    expect(ten.length / ids.length).toBeLessThan(0.13);
    expect(fifty.length / ids.length).toBeGreaterThan(0.45);
    expect(fifty.length / ids.length).toBeLessThan(0.55);
    expect(ten.every((id) => fifty.includes(id))).toBe(true);
  });

  it("off is off, 100% is everyone, partial needs a signed-in user", () => {
    expect(flagOn({ enabled: false, rollout_percent: 100 }, "f", "u")).toBe(false);
    expect(flagOn(null, "f", "u")).toBe(false);
    expect(flagOn({ enabled: true, rollout_percent: 100 }, "f", null)).toBe(true);
    expect(flagOn({ enabled: true, rollout_percent: 99 }, "f", null)).toBe(false);
    expect(flagOn({ enabled: true, rollout_percent: 0 }, "f", "u")).toBe(false);
  });
});

describe("announcements", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const rows = [
    { id: 1, starts_at: "2026-11-01T00:00:00Z", ends_at: null },
    { id: 2, starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-05T12:00:00Z" },
    { id: 3, starts_at: "2026-11-06T00:00:00Z", ends_at: null },
    { id: 4, starts_at: "2026-11-05T11:59:00Z", ends_at: "2026-11-05T13:00:00Z" },
  ];

  it("scheduled, live, ended (the end is exclusive)", () => {
    expect(rows.map((r) => announcementState(r, now))).toEqual([
      "live",
      "ended",
      "scheduled",
      "live",
    ]);
    expect(liveAnnouncements(rows, now).map((r) => r.id)).toEqual([4, 1]);
  });

  it("reads the form's local time as Warsaw time, in winter and summer", () => {
    expect(warsawLocalToIso("2026-12-01T09:30")).toBe("2026-12-01T08:30:00.000Z");
    expect(warsawLocalToIso("2026-07-01T09:30")).toBe("2026-07-01T07:30:00.000Z");
    expect(warsawLocalToIso("")).toBeNull();
    expect(warsawLocalToIso("jutro")).toBeNull();
  });
});

describe("AI budget settings", () => {
  const base = { dailyBudgetUsd: 5, userDailyQuota: 20, ipDailyLimit: 60 };

  it("stored values override the env defaults; missing or invalid ones keep them", () => {
    expect(withSettings(base, { dailyBudgetUsd: 2.5 })).toEqual({ ...base, dailyBudgetUsd: 2.5 });
    expect(withSettings(base, null)).toEqual(base);
    expect(withSettings(base, { dailyBudgetUsd: -1 })).toEqual(base);
    expect(withSettings(base, { userDailyQuota: 1.5 })).toEqual(base);
  });

  it("the form schema bounds every field", () => {
    expect(aiSettingsSchema.safeParse(base).success).toBe(true);
    expect(aiSettingsSchema.safeParse({ ...base, dailyBudgetUsd: 1e9 }).success).toBe(false);
  });
});
