import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

import { aiGradeSchema } from "./grade-schema";
import type { GraderModel, ModelReply } from "./grader";

/** The grader model (your choice: Claude Opus 5.5), overridable with AI_GRADER_MODEL. */
export const DEFAULT_GRADER_MODEL = "claude-opus-5-5";

/**
 * An Anthropic-backed model that answers in a given structured shape. No env access
 * here, so the live eval script can use it too; app code goes through client.ts.
 */
export function anthropicStructured(apiKey: string, id: string, schema: z.ZodType): GraderModel {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  return {
    id,
    async call(system, user): Promise<ModelReply> {
      try {
        const res = await client.messages.parse({
          model: id,
          max_tokens: 16_000,
          // Frozen system prompt: cached across calls.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
          output_config: { effort: "medium", format: zodOutputFormat(schema) },
        });
        if (res.stop_reason === "refusal")
          return { ok: false, reason: "refusal", usage: res.usage };
        if (res.stop_reason === "max_tokens") {
          return { ok: false, reason: "max-tokens", usage: res.usage };
        }
        if (res.parsed_output == null) {
          return { ok: false, reason: "invalid-json", usage: res.usage };
        }
        return { ok: true, output: res.parsed_output, usage: res.usage };
      } catch (e) {
        if (e instanceof Anthropic.APIError) return { ok: false, reason: "api" };
        // The SDK's parse step throws on output that doesn't match the schema.
        return { ok: false, reason: "invalid-json" };
      }
    },
  };
}

/** The open-answer grader (Phase 10). */
export const anthropicGrader = (apiKey: string, id: string = DEFAULT_GRADER_MODEL) =>
  anthropicStructured(apiKey, id, aiGradeSchema);
