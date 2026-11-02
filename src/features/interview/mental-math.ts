import { parseLocaleNumber } from "@/lib/math/parse-number";
import { mulberry32 } from "@/lib/math/rng";

/**
 * Mental math drill (Phase 11): 80 generated questions in 8 minutes, scored in the
 * browser (the plan's "local scoring"; the questions are generated, not course content).
 * Deterministic per seed, so a session can be replayed and tested.
 */
export const MENTAL_MATH = { count: 80, durationMs: 8 * 60_000 } as const;

export type MathTopic = "add" | "sub" | "mul" | "div" | "pct" | "frac";
export type MathQuestion = {
  id: string;
  /** a op b; `pct` reads "a% of b", `frac` asks for a/b as a decimal. Formatted per locale by the UI. */
  a: number;
  op: "+" | "−" | "×" | "÷" | "%" | "/";
  b: number;
  answer: number;
  topic: MathTopic;
};

/** Which topics each level mixes in (later levels also get bigger numbers). */
export const LEVEL_TOPICS: Record<number, readonly MathTopic[]> = {
  1: ["add", "sub", "mul"],
  2: ["add", "sub", "mul", "div"],
  3: ["add", "sub", "mul", "div", "pct"],
  4: ["add", "sub", "mul", "div", "pct", "frac"],
  5: ["add", "sub", "mul", "div", "pct", "frac"],
};

const FRACTIONS: readonly [number, number][] = [
  [1, 2],
  [1, 4],
  [3, 4],
  [1, 5],
  [2, 5],
  [1, 8],
  [3, 8],
  [5, 8],
  [7, 8],
  [1, 16],
  [3, 16],
  [1, 20],
  [3, 20],
  [1, 25],
  [1, 40],
];
const PERCENTS_EASY = [10, 20, 25, 50, 75] as const;
const PERCENTS_HARD = [5, 12.5, 15, 35, 45, 120] as const;

const round = (v: number) => Math.round(v * 1e9) / 1e9;

export function generateMentalMath(level: number, seed: number, count: number = MENTAL_MATH.count) {
  const rand = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const topics = LEVEL_TOPICS[Math.min(5, Math.max(1, level))] ?? LEVEL_TOPICS[1] ?? [];
  const hard = level >= 4;

  const make = (topic: MathTopic): Omit<MathQuestion, "id"> => {
    switch (topic) {
      case "add": {
        const max = level <= 1 ? 99 : level <= 3 ? 999 : 9999;
        const a = int(10, max);
        const b = int(10, max);
        return { a, op: "+", b, answer: a + b, topic };
      }
      case "sub": {
        const max = level <= 1 ? 99 : level <= 3 ? 999 : 9999;
        const a = int(10, max);
        const b = int(10, max);
        const [hi, lo] = level <= 2 ? [Math.max(a, b), Math.min(a, b)] : [a, b];
        return { a: hi, op: "−", b: lo, answer: hi - lo, topic };
      }
      case "mul": {
        const [a, b] =
          level <= 1
            ? [int(2, 10), int(2, 10)]
            : level <= 3
              ? [int(11, 99), int(2, 9)]
              : hard && level === 5
                ? [int(101, 999), int(3, 9)]
                : [int(11, 49), int(11, 29)];
        return { a, op: "×", b, answer: a * b, topic };
      }
      case "div": {
        // Whole results only: build the dividend from the quotient.
        const d = level <= 2 ? int(2, 9) : int(3, 19);
        const q = level <= 2 ? int(2, 12) : int(4, 60);
        return { a: d * q, op: "÷", b: d, answer: q, topic };
      }
      case "pct": {
        const p = level >= 5 ? pick(PERCENTS_HARD) : pick(PERCENTS_EASY);
        const base = level >= 5 ? int(2, 80) * 20 : int(1, 40) * 20;
        return { a: p, op: "%", b: base, answer: round((p / 100) * base), topic };
      }
      case "frac": {
        const [n, d] = pick(FRACTIONS);
        return { a: n, op: "/", b: d, answer: round(n / d), topic };
      }
    }
  };

  return Array.from({ length: count }, (_, i): MathQuestion => {
    const q = make(pick(topics));
    return { id: `mm-${String(seed)}-${String(i)}`, ...q };
  });
}

/**
 * Checks a typed answer: Polish commas, "%", fractions and negatives are read like
 * everywhere else in the app; the result must match exactly (to 1e-9).
 */
export function checkMental(raw: string, q: MathQuestion): boolean {
  const parsed = parseLocaleNumber(raw);
  if (!parsed.ok) return false;
  return Math.abs(parsed.value - q.answer) <= 1e-9;
}
