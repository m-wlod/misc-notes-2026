import "server-only";

import { env } from "@/env";

import { anthropicGrader, DEFAULT_GRADER_MODEL } from "./anthropic-model";
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
