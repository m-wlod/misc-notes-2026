/**
 * Placement quiz: 8 original questions, two per level 1–4. Level 5 (interview-style,
 * open-ended) is not quizzed; a perfect score suggests it.
 *
 * SERVER ONLY. Expected answers live here and must never reach the browser (grading is
 * server-side, CLAUDE.md). Client components get question ids and their translated text
 * from messages/<locale>/placement.json, never this module.
 *
 * Every answer has a `verify` snippet; src/features/placement/questions.test.ts runs it
 * with real Python and compares, so a typo in `expected` fails CI.
 */

export type AnswerUnit =
  /** Answer asked for in percent: "100%" or "100" both mean one hundred percent. */
  | "percentPoints"
  /** A ratio: "0.2", "0,2" or "20%" all mean 0.2. */
  | "fraction"
  /** A plain number. */
  | "number";

export type PlacementQuestion = {
  id: string;
  level: 1 | 2 | 3 | 4;
  expected: number;
  /** Absolute tolerance, in the question's unit. */
  tolerance: number;
  unit: AnswerUnit;
  /** Python that prints the exact answer. */
  verify: string;
};

export const PLACEMENT_QUESTIONS: readonly PlacementQuestion[] = [
  {
    id: "drawdown-recovery",
    level: 1,
    expected: 100,
    tolerance: 0.5,
    unit: "percentPoints",
    verify: "print((1 / (1 - 0.5) - 1) * 100)",
  },
  {
    id: "die-expected-value",
    level: 1,
    expected: 3.5,
    tolerance: 0.001,
    unit: "number",
    verify: "print(sum(range(1, 7)) / 6)",
  },
  {
    id: "three-losses",
    level: 2,
    expected: 0.091125,
    tolerance: 0.0005,
    unit: "fraction",
    verify: "print((1 - 0.55) ** 3)",
  },
  {
    id: "variance-of-difference",
    level: 2,
    expected: 13,
    tolerance: 0.001,
    unit: "number",
    verify: "print(4 + 9)  # Var(X - Y) = Var(X) + Var(Y) for independent X, Y",
  },
  {
    id: "kelly-even-money",
    level: 3,
    expected: 0.2,
    tolerance: 0.001,
    unit: "fraction",
    verify: "p, b = 0.6, 1.0\nprint((b * p - (1 - p)) / b)",
  },
  {
    id: "sharpe-t-stat",
    level: 3,
    expected: 2,
    tolerance: 0.05,
    unit: "number",
    verify:
      "import math\nprint(1.0 * math.sqrt(4))  # t ≈ SR · √T for T independent yearly returns",
  },
  {
    id: "gbm-log-return",
    level: 4,
    expected: 0.08,
    tolerance: 0.0005,
    unit: "fraction",
    verify: "mu, sigma = 0.10, 0.20\nprint(mu - sigma ** 2 / 2)",
  },
  {
    id: "lognormal-mean",
    level: 4,
    expected: Math.exp(0.5),
    tolerance: 0.001,
    unit: "number",
    verify: "import math\nprint(math.exp(0.5))  # E[e^Z] = e^(σ²/2) for Z ~ N(0, 1)",
  },
];

export const PLACEMENT_IDS = PLACEMENT_QUESTIONS.map((q) => q.id);
