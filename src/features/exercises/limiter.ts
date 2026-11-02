import "server-only";

import { env } from "@/env";
import { sharedKV } from "@/lib/kv/shared";

import { kvLimiter, memoryLimiter } from "./rate-limit";

const OPTIONS = { limit: 30, windowMs: 60_000 };

/** 30 graded actions per minute per caller; shared across instances when Upstash is set. */
export const exerciseLimiter = env.UPSTASH_REDIS_REST_URL
  ? kvLimiter(sharedKV(), { ...OPTIONS, prefix: "rl:exercise" })
  : memoryLimiter(OPTIONS);
