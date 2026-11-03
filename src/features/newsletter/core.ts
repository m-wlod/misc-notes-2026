import { createHmac, timingSafeEqual } from "node:crypto";

import { renderEmail, type Email } from "@/features/notify/email";

/**
 * The weekly newsletter (Phase 19c), pure parts: unsubscribe tokens for subscribers
 * (who have no account, so the token signs the subscriber id), the week's picks, and
 * the two emails (sign-up confirmation, weekly issue).
 */
const mac = (secret: string, id: number) =>
  createHmac("sha256", secret)
    .update(`newsletter.${String(id)}`)
    .digest("base64url");

export const signSubscriber = (secret: string, id: number) => mac(secret, id);

export function verifySubscriber(
  secret: string | undefined,
  id: string,
  token: string,
): number | null {
  if (!secret || !/^[1-9]\d{0,15}$/.test(id)) return null;
  const n = Number(id);
  const expected = Buffer.from(mac(secret, n));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected) ? n : null;
}

export const unsubscribeQuery = (secret: string, id: number) =>
  new URLSearchParams({ i: String(id), s: signSubscriber(secret, id) }).toString();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isConfirmToken = (t: unknown): t is string => typeof t === "string" && UUID.test(t);

/** Weeks since Monday 2026-01-05, for a week's Monday (YYYY-MM-DD). */
export function weekIndex(monday: string): number {
  const days =
    (Date.parse(`${monday}T00:00:00Z`) - Date.parse("2026-01-05T00:00:00Z")) / 86_400_000;
  return Math.floor(days / 7);
}

/**
 * The item of the week: a rotation through the list (sorted by id first), so nothing
 * repeats until everything has had its week, and the same week always gives the same item.
 */
export function pickOfWeek<T extends { id: string }>(
  items: readonly T[],
  monday: string,
): T | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const i = ((weekIndex(monday) % sorted.length) + sorted.length) % sorted.length;
  return sorted[i] ?? null;
}

export type ConfirmWords = {
  subject: string;
  lines: string[];
  cta: string;
  footer: string;
};

export function confirmEmail(to: string, words: ConfirmWords, confirmUrl: string): Email {
  return renderEmail({ to, words, ctaUrl: confirmUrl, unsubscribe: null });
}

export type WeeklyWords = {
  subject: string;
  intro: string;
  problem: string;
  debunk: string;
  cta: string;
  footer: string;
  unsubscribe: string;
};

export function weeklyEmail(input: {
  to: string;
  words: WeeklyWords;
  problem: { text: string; url: string } | null;
  debunk: { claim: string; url: string } | null;
  homeUrl: string;
  unsubscribe: { page: string; post: string };
}): Email {
  const { words } = input;
  const lines = [
    words.intro,
    ...(input.problem ? [`${words.problem}: ${input.problem.text}`, input.problem.url] : []),
    ...(input.debunk ? [`${words.debunk}: ${input.debunk.claim}`, input.debunk.url] : []),
  ];
  return renderEmail({
    to: input.to,
    words: {
      subject: words.subject,
      lines,
      cta: words.cta,
      footer: words.footer,
      unsubscribe: words.unsubscribe,
    },
    ctaUrl: input.problem?.url ?? input.homeUrl,
    unsubscribe: input.unsubscribe,
  });
}
