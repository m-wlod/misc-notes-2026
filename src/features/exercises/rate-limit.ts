/**
 * Rate limiting for grading, hints and solutions (per IP, and per user once accounts
 * exist). In-memory sliding window for now: per server instance, so on Vercel it is a
 * soft limit. TODO(phase-10): an Upstash implementation of RateLimiter when its env vars
 * are set (same interface), for a limit shared by every instance.
 */
export interface RateLimiter {
  /** true if the call is allowed (and counted). */
  hit(key: string, now?: number): boolean;
}

export function memoryLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    hit(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      // Keep the map from growing without bound on a long-lived instance.
      if (hits.size > 10_000) {
        for (const [k, ts] of hits) if (ts.every((t) => now - t >= windowMs)) hits.delete(k);
      }
      return true;
    },
  };
}

/** 30 graded actions per minute per caller. */
export const exerciseLimiter = memoryLimiter({ limit: 30, windowMs: 60_000 });
