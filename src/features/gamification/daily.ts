import { z } from "zod";

/**
 * Problem of the day results (Phase 15): kept in this browser per date and level, and
 * shared as a spoiler-free grid (one square per attempt, like Wordle), never the answer.
 */
export const DAILY_KEY = "qla:daily:v1";
export const MAX_ATTEMPTS = 10;

const result = z.object({
  exerciseId: z.string().max(120),
  marks: z.array(z.enum(["x", "o"])).max(MAX_ATTEMPTS),
  hints: z.number().int().min(0).max(20),
});
const store = z.object({ version: z.literal(1), days: z.record(z.string().max(20), result) });
export type DailyResult = z.infer<typeof result>;
export type DailyStore = z.infer<typeof store>;

export const dailyKey = (day: string, level: number) => `${day}:${String(level)}`;

export function parseDaily(raw: string | null): DailyStore {
  if (!raw) return { version: 1, days: {} };
  try {
    const parsed = store.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { version: 1, days: {} };
  } catch {
    return { version: 1, days: {} };
  }
}

/** Adds one graded attempt; nothing changes once solved or after the attempt limit. */
export function withAttempt(
  raw: string | null,
  key: string,
  exerciseId: string,
  correct: boolean,
  hints: number,
): string {
  const s = parseDaily(raw);
  const r = s.days[key] ?? { exerciseId, marks: [], hints: 0 };
  if (r.marks.includes("o") || r.marks.length >= MAX_ATTEMPTS) return JSON.stringify(s);
  s.days[key] = {
    exerciseId,
    marks: [...r.marks, correct ? "o" : "x"],
    hints: Math.max(r.hints, Math.min(20, hints)),
  };
  // Keep the latest 150 entries (about a month at five levels a day).
  s.days = Object.fromEntries(
    Object.entries(s.days)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-150),
  );
  return JSON.stringify(s);
}

export const solved = (r: DailyResult | undefined) => !!r?.marks.includes("o");

/** 🟥🟥🟩: a red square per miss, green for the solve. */
export const grid = (marks: readonly ("x" | "o")[]) =>
  marks.map((m) => (m === "o" ? "🟩" : "🟥")).join("");

/** Parameters of the share image; strict so the endpoint can't be made to draw anything. */
export const shareParams = z.object({
  // A real calendar date (pentest L5: "2026-99-99" passed the pattern and crashed the card).
  d: z.iso.date(),
  l: z.coerce.number().int().min(1).max(5),
  r: z.string().regex(/^[xo]{1,10}$/),
  h: z.coerce.number().int().min(0).max(20),
  lang: z.enum(["pl", "en"]).default("pl"),
  format: z.enum(["story", "og"]).default("og"),
});
export type ShareParams = z.infer<typeof shareParams>;

export function shareQuery(p: ShareParams): string {
  return new URLSearchParams({
    d: p.d,
    l: String(p.l),
    r: p.r,
    h: String(p.h),
    lang: p.lang,
    format: p.format,
  }).toString();
}

export const SHARE_SIZES = { story: [1080, 1920], og: [1200, 630] } as const;
