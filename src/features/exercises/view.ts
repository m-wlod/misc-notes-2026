import { variantCount, variantOf } from "./grade";
import { exerciseHtml } from "./render-text";
import type { Exercise } from "./schema";

/**
 * What the browser may see of an exercise before it is answered: the prompt (rendered),
 * options (shuffled for ordering), counts and widget settings. Never the answer, the
 * hints, the solution, the rubric, the tests or `verify` (asserted in view.test.ts).
 */
export type PublicOption = { id: string; html: string };
export type PublicExercise = {
  id: string;
  type: Exercise["type"];
  level: number;
  topics: string[];
  lessonIds: string[];
  estimatedMinutes: number;
  sample: boolean;
  variant: number;
  variants: number;
  promptHtml: string;
  options: PublicOption[];
  hintCount: number;
  hasSolution: boolean;
  slider?: { min: number; max: number; step: number };
  starter?: string;
};

type Locale = "pl" | "en";
const pick = (text: { pl: string; en?: string | undefined }, locale: Locale) =>
  locale === "en" ? (text.en ?? text.pl) : text.pl;

/** Deterministic shuffle (so the page is static) that never returns `avoid` (the answer order). */
function shuffled<T>(items: readonly T[], seed: string, avoid: readonly (T | undefined)[]): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  if (out.length > 1 && out.every((x, i) => x === avoid[i])) out.push(out.shift() as T);
  return out;
}

export function publicView(ex: Exercise, variant: number, locale: Locale): PublicExercise {
  const { params, index } = variantOf(ex, variant);
  const html = (t: { pl: string; en?: string | undefined }) =>
    exerciseHtml(pick(t, locale), params, locale);
  const options =
    "options" in ex
      ? (ex.type === "ordering"
          ? shuffled(
              ex.options,
              ex.id,
              ex.answer.map((id) => ex.options.find((o) => o.id === id)),
            )
          : ex.options
        ).map((o) => ({
          id: o.id,
          html: html(o),
        }))
      : [];
  const num = (k: string, fallback: number) =>
    typeof params[k] === "number" ? params[k] : fallback;
  return {
    id: ex.id,
    type: ex.type,
    level: ex.level,
    topics: ex.topics,
    lessonIds: ex.lessonIds,
    estimatedMinutes: ex.estimatedMinutes,
    sample: ex.sample,
    variant: index,
    variants: variantCount(ex),
    promptHtml: html(ex.prompt),
    options,
    hintCount: ex.hints.length,
    hasSolution: ex.solution !== undefined,
    ...(ex.type === "interactive"
      ? { slider: { min: num("min", 0), max: num("max", 100), step: num("step", 1) } }
      : {}),
    ...(ex.type === "code" ? { starter: ex.starter } : {}),
  };
}
