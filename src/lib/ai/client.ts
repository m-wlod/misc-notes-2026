import "server-only";

import { env } from "@/env";

import { anthropicGrader, anthropicStructured, DEFAULT_GRADER_MODEL } from "./anthropic-model";
import { followUpSchema } from "./follow-up";
import type { GraderModel } from "./grader";

export { DEFAULT_GRADER_MODEL };

/**
 * The real grader, or null when ANTHROPIC_API_KEY isn't set (then every open exercise
 * uses the self-check fallback). Server-only: the key never reaches the browser.
 */
export function graderModel(): GraderModel | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return anthropicGrader(env.ANTHROPIC_API_KEY, env.AI_GRADER_MODEL ?? DEFAULT_GRADER_MODEL);
}

/** The interviewer's follow-up model (Phase 11): same key and model, its own output shape. */
export function followUpModel(): GraderModel | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return anthropicStructured(
    env.ANTHROPIC_API_KEY,
    env.AI_GRADER_MODEL ?? DEFAULT_GRADER_MODEL,
    followUpSchema,
  );
}
