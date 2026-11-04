import { describe, expect, it } from "vitest";

import { NO_CONSENT, parseConsent, shouldAsk, withChoice } from "./consent";

describe("consent (Phase 21b)", () => {
  it("anything missing or malformed means essential only", () => {
    expect(parseConsent(null)).toEqual(NO_CONSENT);
    expect(parseConsent("{nope")).toEqual(NO_CONSENT);
    expect(parseConsent(JSON.stringify({ analytics: "yes", embeds: 1 }))).toEqual(NO_CONSENT);
  });

  it("a choice keeps the other category and records when it was made", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const c = withChoice(NO_CONSENT, { embeds: true }, now);
    expect(c).toEqual({ analytics: false, embeds: true, decidedAt: "2026-11-10T12:00:00.000Z" });
    expect(parseConsent(JSON.stringify(c))).toEqual(c);
    expect(withChoice(c, { analytics: true }, now)).toMatchObject({
      analytics: true,
      embeds: true,
    });
  });

  it("the banner asks only when analytics exists and nothing was chosen yet", () => {
    expect(shouldAsk(NO_CONSENT, false)).toBe(false);
    expect(shouldAsk(NO_CONSENT, true)).toBe(true);
    expect(shouldAsk(withChoice(NO_CONSENT, { analytics: false }, new Date()), true)).toBe(false);
  });
});
