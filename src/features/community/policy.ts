/**
 * Posting rules (Phase 17), pure. Limits and the keyword list are first drafts for your
 * review. The filter never deletes: a matching post is held for a moderator (status
 * pending) and its author is told so.
 */
export const NEW_ACCOUNT_DAYS = 7;
export const POST_LIMITS = { perTenMinutes: 5, perDay: 30 } as const;
export const MIN_POST_CHARS = 2;

/** Accounts younger than this can't post clickable links. */
export function linksAllowed(accountCreatedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - accountCreatedAt.getTime() >= NEW_ACCOUNT_DAYS * 86_400_000;
}

/**
 * Patterns that hold a post for review: signal-group and "DM me" pitches, guaranteed
 * profit, crypto-scam bait, and slurs (kept short here; extend in review). Polish
 * diacritics are folded so "gwarantowany zysk" and "gwarantowany zysk" both match.
 */
const HOLD_PATTERNS: RegExp[] = [
  /\b(?:t\.me|telegram|whats ?app|signal grup|grupa sygnalow|vip group|grupa vip)\b/,
  /\b(?:dm me|napisz (?:na )?priv|pisz (?:na )?priv|priv me|zapraszam na priv)\b/,
  /\b(?:gwarantowan\w* zysk\w*|guaranteed (?:profit|returns?)|pewny zysk|100 ?% (?:skutecznosci|win rate))\b/,
  /\b(?:podwoje twoje|double your (?:money|crypto|btc)|send (?:me )?(?:btc|usdt|eth))\b/,
  /\b(?:kurwa|chuj|pierdol\w*|spierdalaj|fuck you|retard\w*)\b/,
];

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(
      /[ąćęłńóśźż]/g,
      (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" })[c] ?? c,
    );

export type Screening = { status: "approved" | "pending"; reason: "keyword" | null };

export function screen(body: string): Screening {
  const text = fold(body);
  return HOLD_PATTERNS.some((p) => p.test(text))
    ? { status: "pending", reason: "keyword" }
    : { status: "approved", reason: null };
}

export type PostCheck =
  | { ok: true }
  | { ok: false; reason: "too-short" | "too-long" | "rate-limited" | "banned" | "locked" };

/** Counts of the author's recent posts → may they post now? */
export function rateOk(recent: { lastTenMinutes: number; lastDay: number }): boolean {
  return recent.lastTenMinutes < POST_LIMITS.perTenMinutes && recent.lastDay < POST_LIMITS.perDay;
}

/** Helper badges from reputation (profiles). */
export const HELPER_BADGES = [
  { id: "pomocny", min: 10 },
  { id: "mentor", min: 50 },
  { id: "filar", min: 200 },
] as const;

export const badgesFor = (reputation: number) =>
  HELPER_BADGES.filter((b) => reputation >= b.min).map((b) => b.id);
