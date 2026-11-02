import { createHash } from "node:crypto";

import type { AiGrade } from "@/lib/ai/grade-schema";
import type { KV } from "@/lib/kv/store";

/**
 * Identical answers get the cached grade (Phase 10): no model call and no quota used.
 * The key is a hash of the exercise, its version, the language and the answer with
 * spacing and case normalised.
 */
const TTL = 30 * 86_400;

export const normaliseAnswer = (s: string) => s.trim().replaceAll(/\s+/g, " ").toLowerCase();

export function cacheKey(exerciseId: string, version: number, lang: string, answer: string) {
  const h = createHash("sha256")
    .update(`${exerciseId}\n${String(version)}\n${lang}\n${normaliseAnswer(answer)}`)
    .digest("hex");
  return `ai:grade:${h}`;
}

export const getCached = (kv: KV, key: string) => kv.get<AiGrade>(key);
export const setCached = (kv: KV, key: string, grade: AiGrade) => kv.set(key, grade, TTL);
