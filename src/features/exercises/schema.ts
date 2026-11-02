import { z } from "zod";

import { parseExpr } from "@/lib/math/expr";

/**
 * Exercise files: `content/exercises/<track>/<lesson-id>/<exercise-id>.yaml`.
 * Phase 7 defines the format and the checks (schema, Python `verify`, QA); Phase 8 adds
 * the renderers and server-side grading. Exercises are read by server code and scripts
 * only, never shipped to the browser (answers are graded on the server, CLAUDE.md).
 */

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase-kebab-case (a–z, 0–9, hyphens)");

/** Polish required, English optional (falls back to Polish). Text may use MDX math. */
const text = z.object({ pl: z.string().min(1), en: z.string().min(1).optional() }).strict();

const option = z.object({ id, pl: z.string().min(1), en: z.string().min(1).optional() }).strict();

const base = {
  id,
  level: z.number().int().min(1).max(5),
  topics: z.array(z.string().min(1)).min(1),
  /** Lessons this exercise practises (must exist). */
  lessonIds: z.array(id).min(1),
  prompt: text,
  /** Values for randomised variants; also passed to `verify`. Use `seed` for simulations. */
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  /** Ordered; each one costs XP (Phase 14). QA requires at least one. */
  hints: z.array(text).default([]),
  /** Step by step; QA requires it. */
  solution: text.optional(),
  estimatedMinutes: z.number().int().min(1).max(60),
  source: z
    .object({
      book: z.string().min(1),
      chapter: z.string().optional(),
      page: z.union([z.number(), z.string()]).optional(),
    })
    .strict()
    .optional(),
  status: z.enum(["draft", "review", "published"]),
  /** Placeholder exercises that demonstrate the engine (Phase 8); never real content. */
  sample: z.boolean().default(false),
  /**
   * Python that computes the answer from `params` and assigns it to `result`.
   * `pnpm content:verify` runs it and compares with `answer`.
   */
  verify: z.string().min(1).optional(),
};

const params = z.record(z.string(), z.union([z.number(), z.string(), z.boolean()]));

/**
 * A typical wrong answer and the feedback it deserves (Phase 9). `answer` is a number or
 * an expression in our expression language (so it can use params, e.g. "k * r / 100").
 */
const mistake = z
  .object({ answer: z.union([z.number(), z.string().min(1)]), feedback: text })
  .strict();

/** Randomised params per learner (Phase 9): a range or a list per param, and the formula. */
const paramSpec = z.union([
  z.object({ min: z.number(), max: z.number(), step: z.number().positive().optional() }).strict(),
  z.object({ choices: z.array(z.number()).min(2) }).strict(),
]);
const random = z
  .object({
    params: z.record(z.string().regex(/^[a-zA-Z]\w*$/), paramSpec),
    /** The answer from the params, in our expression language: the TS twin of `verify`. */
    formula: z.string().min(1),
  })
  .strict();

const numericAnswer = {
  answer: z.number(),
  /** Absolute tolerance for grading and for `verify`. */
  tolerance: z.number().min(0).default(1e-9),
  /** Relative tolerance (share of the answer); either tolerance passing is enough. */
  relTolerance: z.number().min(0).max(1).optional(),
  /** How a typed "%" reads: fraction (25% = 0,25, default), percent (answer in %), number. */
  unit: z.enum(["fraction", "percent", "number"]).default("fraction"),
  mistakes: z.array(mistake).default([]),
  /** Different numbers per learner; `answer` is then the answer for the base `params`. */
  random: random.optional(),
  /**
   * Further versions of the same exercise ("similar exercise"): params that override the
   * base params, and the answer for them. `content:verify` checks every variant.
   */
  variants: z.array(z.object({ params, answer: z.number() }).strict()).default([]),
};

export const exerciseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("numeric"), ...base, ...numericAnswer }).strict(),
  z.object({ type: z.literal("estimation"), ...base, ...numericAnswer }).strict(),
  // TODO(phase-8): widget config for interactive exercises.
  z
    .object({ type: z.literal("interactive"), ...base, ...numericAnswer, widget: z.string() })
    .strict(),
  z
    .object({
      type: z.literal("symbolic"),
      ...base,
      answer: z.string().min(1),
      variants: z.array(z.object({ params, answer: z.string().min(1) }).strict()).default([]),
      mistakes: z.array(mistake).default([]),
    })
    .strict(),
  z
    .object({
      type: z.literal("choice"),
      ...base,
      options: z.array(option).min(2),
      answer: id,
    })
    .strict(),
  z
    .object({
      type: z.literal("multi"),
      ...base,
      options: z.array(option).min(2),
      answer: z.array(id).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("ordering"),
      ...base,
      options: z.array(option).min(2),
      answer: z.array(id).min(2),
    })
    .strict(),
  z
    .object({
      type: z.literal("code"),
      ...base,
      starter: z.string().default(""),
      /** Hidden Python tests (Phase 12 runs them in the browser sandbox). */
      tests: z.string().min(1),
    })
    .strict(),
  z
    .object({ type: z.literal("open"), ...base, rubric: z.array(z.string().min(1)).min(1) })
    .strict(),
  z
    .object({
      type: z.literal("brainteaser"),
      ...base,
      rubric: z.array(z.string().min(1)).min(1),
      answer: z.string().optional(),
      followUp: text.optional(),
    })
    .strict(),
]);

export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseType = Exercise["type"];

/** Types whose answer is computed, so a `verify` block is required. */
export const VERIFIED_TYPES = ["numeric", "estimation", "interactive", "symbolic"] as const;

/** Rules a single exercise must meet beyond its shape. */
export function exerciseRuleErrors(ex: Exercise): string[] {
  const errors: string[] = [];
  if ((VERIFIED_TYPES as readonly string[]).includes(ex.type) && !ex.verify) {
    errors.push(
      `verify: a ${ex.type} exercise needs a Python verify block that computes the answer`,
    );
  }
  if ("random" in ex && ex.random) {
    if (ex.variants.length > 0)
      errors.push("random: use either random params or variants, not both");
    for (const [name, spec] of Object.entries(ex.random.params)) {
      if ("min" in spec && spec.min > spec.max)
        errors.push(`random.params.${name}: min is above max`);
    }
    try {
      parseExpr(ex.random.formula);
    } catch (e) {
      errors.push(`random.formula: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if ("mistakes" in ex) {
    ex.mistakes.forEach((m, i) => {
      if (typeof m.answer === "string") {
        try {
          parseExpr(m.answer);
        } catch (e) {
          errors.push(
            `mistakes[${String(i)}].answer: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    });
  }
  if ("options" in ex) {
    const ids = new Set(ex.options.map((o) => o.id));
    if (ids.size !== ex.options.length) errors.push("options: option ids must be unique");
    const answers = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
    for (const a of answers) {
      if (!ids.has(a)) errors.push(`answer: "${a}" is not one of the option ids`);
    }
    if (ex.type === "ordering" && ex.answer.length !== ex.options.length) {
      errors.push("answer: an ordering lists every option exactly once");
    }
  }
  return errors;
}
