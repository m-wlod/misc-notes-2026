import type { KV } from "@/lib/kv/store";

/**
 * Rate limiting for grading, hints and solutions (per IP, and per user once accounts
 * exist). In memory per server instance by default (a soft limit on Vercel); with
 * Upstash configured, `kvLimiter` gives one limit shared by every instance (Phase 10).
 */
export interface RateLimiter {
  /** true if the call is allowed (and counted). */
  hit(key: string, now?: number): boolean | Promise<boolean>;
}

/** Sliding window in memory. */
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

/** Fixed window on a shared store (Upstash): one counter per key per window. */
export function kvLimiter(
  kv: KV,
  { limit, windowMs, prefix }: { limit: number; windowMs: number; prefix: string },
): RateLimiter {
  return {
    async hit(key, now = Date.now()) {
      const window = Math.floor(now / windowMs);
      const count = await kv.incr(
        `${prefix}:${String(window)}:${key}`,
        1,
        Math.ceil(windowMs / 1000),
      );
      return count <= limit;
    },
  };
}
