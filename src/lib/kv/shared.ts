import "server-only";

import { env } from "@/env";

import { memoryKV, upstashKV, type KV } from "./store";

let shared: KV | undefined;

/** The process-wide store: Upstash when configured, else in memory (per instance). */
export function sharedKV(): KV {
  shared ??=
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? upstashKV(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
      : memoryKV();
  return shared;
}
