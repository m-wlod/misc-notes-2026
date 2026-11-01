import { describe, expect, it } from "vitest";

import { profileUpdateSchema } from "./profile-schema";

describe("profileUpdateSchema", () => {
  it("accepts the fields a user may change", () => {
    const ok = profileUpdateSchema.safeParse({
      display_name: "Ania",
      handle: "kwant_ania",
      locale: "en",
      goal: "interviews",
      self_level: 3,
      daily_goal_minutes: 20,
      timezone: "Europe/Warsaw",
      is_public: true,
      league_opt_out: false,
    });
    expect(ok.success).toBe(true);
  });

  it("strips server-owned fields instead of passing them through", () => {
    const parsed = profileUpdateSchema.parse({
      display_name: "x",
      placement_level: 5,
      onboarded_at: "2026-01-01",
      id: "other",
    });
    expect(parsed).toEqual({ display_name: "x" });
  });

  it.each([
    [{ handle: "Has Spaces" }],
    [{ handle: "ab" }],
    [{ daily_goal_minutes: 7 }],
    [{ self_level: 6 }],
    [{ locale: "de" }],
    [{ goal: "get-rich" }],
    [{ display_name: "x".repeat(61) }],
  ])("rejects %j", (input) => {
    expect(profileUpdateSchema.safeParse(input).success).toBe(false);
  });
});
