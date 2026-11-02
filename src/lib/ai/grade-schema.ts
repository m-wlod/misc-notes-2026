import { z } from "zod";

/**
 * What the AI grader returns for an open answer (Phase 10). Validated with Zod both by
 * the SDK (structured output) and again by us, then passed through the guards.
 */
export const rubricStatus = z.enum(["met", "partially", "missed"]);

export const aiGradeSchema = z.object({
  /** 0–4. The guards cap it by the rubric items actually met. */
  score: z.number().int().min(0).max(4),
  verdict: z.enum(["correct", "partial", "wrong"]),
  rubricItems: z.array(
    z.object({
      /** Index into the exercise's rubric (0-based). */
      index: z.number().int().min(0),
      status: rubricStatus,
      reason: z.string(),
    }),
  ),
  /** In the learner's language, mentor tone, pointing to the specific mistake. */
  feedback: z.string(),
  misconceptions: z.array(z.string()),
  nextStep: z.string(),
});

export type AiGrade = z.infer<typeof aiGradeSchema>;
export type RubricStatus = z.infer<typeof rubricStatus>;
