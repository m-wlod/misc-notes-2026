import "server-only";

import { headers } from "next/headers";

import { env } from "@/env";
import { kvLimiter, memoryLimiter, type RateLimiter } from "@/features/exercises/rate-limit";
import { sharedKV } from "@/lib/kv/shared";

/**
 * Rate limits for every write a client can trigger (Phase 21). One limiter per action,
 * shared across instances when Upstash is configured, per instance otherwise. Keys are
 * the user id when signed in, else the client IP (or an e-mail address for the actions
 * that send mail to it). `scripts`-level test: src/lib/rate/write.test.ts checks that
 * every server action that writes calls a limiter.
 */
const MIN = 60_000;
const HOUR = 60 * MIN;

export const WRITE_LIMITS = {
  vote: { limit: 120, windowMs: 10 * MIN },
  report: { limit: 10, windowMs: 10 * MIN },
  shareSolution: { limit: 5, windowMs: 10 * MIN },
  editComment: { limit: 30, windowMs: 10 * MIN },
  deleteComment: { limit: 30, windowMs: 10 * MIN },
  reportUnfairGrade: { limit: 10, windowMs: 24 * HOUR },
  submitChallenge: { limit: 5, windowMs: HOUR },
  saveInterviewSession: { limit: 30, windowMs: HOUR },
  mergeAnonymousProgress: { limit: 10, windowMs: HOUR },
  completeLesson: { limit: 60, windowMs: 10 * MIN },
  claimCertificate: { limit: 10, windowMs: HOUR },
  claimAchievement: { limit: 30, windowMs: 10 * MIN },
  finishEntry: { limit: 60, windowMs: HOUR },
  reviewCard: { limit: 300, windowMs: 10 * MIN },
  settings: { limit: 20, windowMs: 10 * MIN },
  deleteAccount: { limit: 5, windowMs: HOUR },
  placement: { limit: 10, windowMs: HOUR },
  onboarding: { limit: 10, windowMs: 10 * MIN },
  /** Sign-in links and OAuth starts, per IP. */
  signIn: { limit: 10, windowMs: HOUR },
  /** Mail to one address (sign-in links, newsletter confirmations), whoever asks. */
  mailTo: { limit: 3, windowMs: HOUR },
  /** Links from e-mails (confirm, unsubscribe), per IP. */
  emailLink: { limit: 30, windowMs: 10 * MIN },
} as const;

export type WriteAction = keyof typeof WRITE_LIMITS;

const limiters = new Map<WriteAction, RateLimiter>();
function limiterFor(action: WriteAction): RateLimiter {
  let l = limiters.get(action);
  if (!l) {
    const opts = WRITE_LIMITS[action];
    l = env.UPSTASH_REDIS_REST_URL
      ? kvLimiter(sharedKV(), { ...opts, prefix: `rl:w:${action}` })
      : memoryLimiter(opts);
    limiters.set(action, l);
  }
  return l;
}

/** true if this caller may do `action` now (and counts it). */
export async function allowWrite(action: WriteAction, key: string): Promise<boolean> {
  return limiterFor(action).hit(key);
}

/**
 * The client's IP as the platform reports it. On Vercel the first `x-forwarded-for`
 * entry is set by the edge and can't be forged by the client; elsewhere it can be, so
 * production runs on Vercel (docs/PROGRESS.md, security checklist).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}
