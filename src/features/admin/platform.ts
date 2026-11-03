import { z } from "zod";

/**
 * Pure helpers for the platform controls (Phase 18c): feature-flag rollout and
 * announcement windows. Server code and tests share them.
 */

/** FNV-1a, 32-bit: small, fast and stable across runtimes. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The user's bucket for a flag, 0–99. Same user and flag, same bucket, always. */
export const bucketOf = (key: string, userId: string) => fnv1a(`${key}:${userId}`) % 100;

export type FlagRow = { enabled: boolean; rollout_percent: number };

/**
 * Whether a flag is on for this viewer. Off flags are off for everyone; 100% is on for
 * everyone; anything in between needs a signed-in user (visitors without an id stay out,
 * so a partial rollout never flickers between page loads).
 */
export function flagOn(flag: FlagRow | null | undefined, key: string, userId: string | null) {
  if (!flag?.enabled) return false;
  if (flag.rollout_percent >= 100) return true;
  if (flag.rollout_percent <= 0 || userId === null) return false;
  return bucketOf(key, userId) < flag.rollout_percent;
}

export const FLAG_KEY = /^[a-z0-9_.-]{2,60}$/;

export type AnnouncementWindow = { starts_at: string; ends_at: string | null };

export type AnnouncementState = "scheduled" | "live" | "ended";

export function announcementState(a: AnnouncementWindow, now: Date): AnnouncementState {
  if (new Date(a.starts_at) > now) return "scheduled";
  if (a.ends_at !== null && new Date(a.ends_at) <= now) return "ended";
  return "live";
}

/** The ones to show now, newest first. */
export function liveAnnouncements<T extends AnnouncementWindow & { id: number }>(
  rows: readonly T[],
  now: Date,
): T[] {
  return rows.filter((r) => announcementState(r, now) === "live").sort((a, b) => b.id - a.id);
}

/**
 * Reads a `datetime-local` value as Warsaw time (the panel's time zone) and returns an
 * ISO instant, or null for an empty or invalid value.
 */
export function warsawLocalToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asUtc)) return null;
  // Warsaw's offset at that moment: format the UTC guess in Warsaw and compare.
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - t;
  };
  const guess = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(guess)).toISOString();
}

/** What `admin_ai_costs` returns. */
const costSchema = z.object({
  days: z.array(z.object({ day: z.string(), calls: z.number().int(), cost: z.number() })),
  users: z.array(
    z.object({
      user_id: z.string(),
      handle: z.string().nullable(),
      calls: z.number().int(),
      cost: z.number(),
    }),
  ),
  exercises: z.array(
    z.object({ exercise_id: z.string().nullable(), calls: z.number().int(), cost: z.number() }),
  ),
});
export type Costs = z.infer<typeof costSchema>;

export function parseCosts(data: unknown): Costs | null {
  const parsed = costSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
