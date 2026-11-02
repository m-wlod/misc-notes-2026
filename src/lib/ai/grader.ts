import { costOf, type Usage } from "./cost";
import { aiGradeSchema, type AiGrade } from "./grade-schema";
import { applyGuards } from "./guards";
import { buildUserMessage, SYSTEM_PROMPT, type PromptInput } from "./prompt";

/**
 * Grading an open answer (Phase 10): one model call with structured output, validated,
 * retried once on invalid output, then guarded. Any failure falls back to "compare with
 * the reference solution", so the exercise stays useful. The model is injected, so the
 * whole flow is tested without an API key.
 */
export type ModelReply =
  | { ok: true; output: unknown; usage: Usage }
  | { ok: false; reason: "refusal" | "max-tokens" | "api" | "invalid-json"; usage?: Usage };

export interface GraderModel {
  readonly id: string;
  call(system: string, user: string): Promise<ModelReply>;
}

export type GradeOutcome =
  | { ok: true; grade: AiGrade; costUsd: number; usage: Usage }
  | { ok: false; reason: "fallback"; costUsd: number; usage: Usage };

const add = (a: Usage, b: Usage | undefined): Usage =>
  b
    ? {
        input_tokens: a.input_tokens + b.input_tokens,
        output_tokens: a.output_tokens + b.output_tokens,
        cache_read_input_tokens:
          (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
        cache_creation_input_tokens:
          (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
      }
    : a;

export async function gradeOpen(input: PromptInput, model: GraderModel): Promise<GradeOutcome> {
  const user = buildUserMessage(input);
  let usage: Usage = { input_tokens: 0, output_tokens: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await model.call(SYSTEM_PROMPT, user);
    usage = add(usage, reply.usage);
    if (reply.ok) {
      const parsed = aiGradeSchema.safeParse(reply.output);
      if (parsed.success) {
        return {
          ok: true,
          grade: applyGuards(parsed.data, input.rubric.length),
          costUsd: costOf(model.id, usage),
          usage,
        };
      }
    } else if (reply.reason !== "invalid-json") {
      break; // a refusal, truncation or API error won't improve on a retry
    }
  }
  return { ok: false, reason: "fallback", costUsd: costOf(model.id, usage), usage };
}
