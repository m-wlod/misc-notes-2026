import { z } from "zod/mini";

import { store } from "@/features/reader/storage";

import { SESSION_KINDS, type Scorecard, type SessionKind } from "./session";

/**
 * Interview scorecards kept in this browser (Phase 11) until accounts exist; with an
 * account they are also written to interview_sessions. Pure helpers take and return the
 * raw stored string, so they are unit-tested without a DOM.
 */
export const INTERVIEW_KEY = "qla:interview:v1";
export const MAX_SESSIONS = 200;

const entry = z.object({
  id: z.string().check(z.maxLength(80)),
  kind: z.enum(SESSION_KINDS),
  level: z.number().check(z.int(), z.gte(1), z.lte(5)),
  finishedAt: z.iso.datetime(),
  score: z.number().check(z.gte(0), z.lte(1)),
  correct: z.number().check(z.int(), z.gte(0)),
  answered: z.number().check(z.int(), z.gte(0)),
  total: z.number().check(z.int(), z.gte(0)),
  avgMs: z.nullable(z.number()),
  durationMs: z.number(),
  review: z.array(z.string().check(z.maxLength(60))).check(z.maxLength(20)),
  /** Market making: total P&L of the session. */
  pnl: z.optional(z.number()),
  /** Set when saved: this session beat the previous best for its kind and level. */
  personalBest: z.optional(z.boolean()),
});

export const interviewSchema = z.object({
  version: z.literal(1),
  sessions: z.array(entry).check(z.maxLength(MAX_SESSIONS)),
  /** Best score per kind and level ("mental_math:3" → 0.85). Kept apart from the capped list. */
  best: z.record(z.string().check(z.maxLength(40)), z.number()),
});
export type InterviewState = z.infer<typeof interviewSchema>;
export type SessionEntry = z.infer<typeof entry>;

export const emptyInterview = (): InterviewState => ({ version: 1, sessions: [], best: {} });
export const bestKey = (kind: SessionKind, level: number) => `${kind}:${String(level)}`;

export function parseInterview(raw: string | null): InterviewState {
  if (!raw) return emptyInterview();
  try {
    const parsed = interviewSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyInterview();
  } catch {
    return emptyInterview();
  }
}

/** Adds a finished session; returns the new raw state and whether it set a personal best. */
export function withSession(
  raw: string | null,
  e: SessionEntry,
): { raw: string; personalBest: boolean } {
  const state = parseInterview(raw);
  if (state.sessions.some((s) => s.id === e.id))
    return { raw: JSON.stringify(state), personalBest: false };
  const key = bestKey(e.kind, e.level);
  const previous = state.best[key];
  const personalBest = e.answered > 0 && (previous === undefined || e.score > previous);
  if (personalBest) state.best[key] = e.score;
  state.sessions = [...state.sessions, { ...e, personalBest }].slice(-MAX_SESSIONS);
  return { raw: JSON.stringify(state), personalBest };
}

export function entryFrom(
  id: string,
  kind: SessionKind,
  level: number,
  card: Scorecard,
  finishedAt: Date,
  pnl?: number,
): SessionEntry {
  return {
    id,
    kind,
    level,
    finishedAt: finishedAt.toISOString(),
    score: Math.round(card.score * 1e4) / 1e4,
    correct: card.correct,
    answered: card.answered,
    total: card.total,
    avgMs: card.avgMs === null ? null : Math.round(card.avgMs),
    durationMs: card.durationMs,
    review: card.review.slice(0, 20),
    ...(pnl === undefined ? {} : { pnl: Math.round(pnl * 100) / 100 }),
  };
}

/** Browser side: saves a scorecard; returns whether it is a personal best. */
export function saveSession(e: SessionEntry): boolean {
  let best = false;
  store(INTERVIEW_KEY, (raw) => {
    const out = withSession(raw, e);
    best = out.personalBest;
    return out.raw;
  });
  return best;
}
