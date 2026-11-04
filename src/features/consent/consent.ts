/**
 * Consent (Phase 21b). Only essential storage is used by default: the session, the
 * language, the exercise seed and local preferences. Anything else waits for a choice:
 * - `analytics`: product analytics (PostHog, Phase 22), off until accepted;
 * - `embeds`: YouTube and TikTok players load by themselves (otherwise only on a click).
 * The choice lives in this browser only (localStorage) and can be changed any time on the
 * cookies page. Push notifications need the browser's own permission and are not here.
 */
export const CONSENT_KEY = "qla:consent:v1";
export const CONSENT_EVENT = "qla:consent";

export const CATEGORIES = ["analytics", "embeds"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Consent = { analytics: boolean; embeds: boolean; decidedAt: string | null };

export const NO_CONSENT: Consent = { analytics: false, embeds: false, decidedAt: null };

/** Reads a stored choice; anything malformed counts as no choice (= essential only). */
export function parseConsent(raw: string | null): Consent {
  if (!raw) return NO_CONSENT;
  try {
    const v = JSON.parse(raw) as Partial<Record<string, unknown>>;
    return {
      analytics: v.analytics === true,
      embeds: v.embeds === true,
      decidedAt: typeof v.decidedAt === "string" ? v.decidedAt : null,
    };
  } catch {
    return NO_CONSENT;
  }
}

export function withChoice(
  current: Consent,
  choice: Partial<Record<Category, boolean>>,
  now: Date,
): Consent {
  return {
    analytics: choice.analytics ?? current.analytics,
    embeds: choice.embeds ?? current.embeds,
    decidedAt: now.toISOString(),
  };
}

/** The banner asks only when something that needs consent is switched on, and only once. */
export const shouldAsk = (consent: Consent, analyticsConfigured: boolean) =>
  analyticsConfigured && consent.decidedAt === null;
