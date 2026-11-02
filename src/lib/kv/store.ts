import { Redis } from "@upstash/redis";

/**
 * A tiny key-value store for quotas, the spend counter and the answer cache (Phase 10).
 * Upstash when its env vars are set (shared by every server instance); otherwise in
 * memory, per instance: fine locally and as a soft limit, which is all we need while
 * AI grading is switched off.
 */
export interface KV {
  /** Adds `by` and returns the new value; the key expires `ttlSeconds` after creation. */
  incr(key: string, by: number, ttlSeconds: number): Promise<number>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export function memoryKV(now: () => number = Date.now): KV {
  const data = new Map<string, { value: unknown; expires: number }>();
  const live = (key: string) => {
    const e = data.get(key);
    if (e && e.expires <= now()) {
      data.delete(key);
      return undefined;
    }
    return e;
  };
  return {
    incr(key, by, ttlSeconds) {
      const e = live(key);
      const value = (typeof e?.value === "number" ? e.value : 0) + by;
      data.set(key, { value, expires: e?.expires ?? now() + ttlSeconds * 1000 });
      return Promise.resolve(value);
    },
    get<T>(key: string) {
      return Promise.resolve((live(key)?.value as T | undefined) ?? null);
    },
    set(key, value, ttlSeconds) {
      data.set(key, { value, expires: now() + ttlSeconds * 1000 });
      return Promise.resolve();
    },
  };
}

export function upstashKV(url: string, token: string): KV {
  const redis = new Redis({ url, token });
  return {
    async incr(key, by, ttlSeconds) {
      const value = await redis.incrbyfloat(key, by);
      // Set the expiry only when the key is new (NX), so the window doesn't slide.
      await redis.expire(key, ttlSeconds, "NX");
      return value;
    },
    get: (key) => redis.get(key),
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    },
  };
}
