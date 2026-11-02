import { spawnSync } from "node:child_process";

import type { Exercise } from "@/features/exercises/schema";
import { formulaAnswer, paramsFor } from "@/features/grading/random";
import { closeEnough, symbolicMatch } from "@/features/grading/rules";
import { evaluate, parseExpr } from "@/lib/math/expr";

import type { LoadedExercise } from "./load";

/**
 * `pnpm content:verify`: every exercise with a `verify` block is run with real Python
 * (isolated mode, timeout) and its computed result is compared with the stored answer.
 * The block sees `params` as variables and must assign `result`.
 */

const MARK = "__QLA_RESULT__";
export const TIMEOUT_MS = 10_000;

/** The Python program for one exercise: params as variables, then the block, then output. */
export function harness(verify: string, params: Exercise["params"]): string {
  return [
    "import json as __json",
    `params = __json.loads(${JSON.stringify(JSON.stringify(params))})`,
    "globals().update(params)",
    "result = None",
    verify,
    `print(${JSON.stringify(MARK)} + __json.dumps(result))`,
  ].join("\n");
}

/** Seeds per random exercise for the TS/Python parity check. */
export const PARITY_SEEDS = 100;

/** One Python process for many param sets: the block runs once per set, in a fresh scope. */
export function batchHarness(verify: string, sets: readonly Exercise["params"][]): string {
  return [
    "import json as __json",
    `__code = compile(${JSON.stringify(verify)}, "verify", "exec")`,
    `for __p in __json.loads(${JSON.stringify(JSON.stringify(sets))}):`,
    "    __g = dict(__p, params=__p, result=None)",
    "    exec(__code, __g)",
    `    print(${JSON.stringify(MARK)} + __json.dumps(__g["result"]))`,
  ].join("\n");
}

export type RunResult = { ok: true; stdout: string } | { ok: false; error: string };
export type Runner = (program: string) => RunResult;

export const PYTHON = process.platform === "win32" ? "python" : "python3";

/** Runs a program with real Python: `-I` (isolated: no user site, no cwd on sys.path). */
export const pythonRunner: Runner = (program) => runPython(["-I"], program, TIMEOUT_MS);

/**
 * For code exercises, which need numpy and pandas: `-E -P` keeps environment variables
 * and the current directory out, but allows user site-packages (`pip install --user`).
 * pandas is slow to import, hence the longer limit.
 */
export const pythonWithPackagesRunner: Runner = (program) =>
  runPython(["-E", "-P"], program, TIMEOUT_MS * 3);

function runPython(flags: string[], program: string, timeout: number) {
  const r = spawnSync(PYTHON, [...flags, "-c", program], { encoding: "utf8", timeout });
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code;
    return {
      ok: false as const,
      error: code === "ETIMEDOUT" ? `timed out after ${String(timeout / 1000)} s` : r.error.message,
    };
  }
  if (r.status !== 0) {
    const last = r.stderr.trim().split("\n").at(-1) ?? "failed";
    return { ok: false as const, error: `python error: ${last}` };
  }
  return { ok: true as const, stdout: r.stdout };
}

/** Randomness without a fixed seed would make the stored answer unverifiable. */
export function unseededRandomness(ex: Exercise): boolean {
  return /\b(random|np\.random|numpy\.random)\b/.test(ex.verify ?? "") && !("seed" in ex.params);
}

const normalise = (s: string) => s.replaceAll(/\s+/g, "").replaceAll("**", "^").toLowerCase();

/** Compare a computed result with the stored answer; null = match, else the reason. */
export function compare(ex: Exercise, result: unknown): string | null {
  if (ex.type === "symbolic") {
    if (typeof result !== "string")
      return `expected an expression string, got ${JSON.stringify(result)}`;
    return normalise(result) === normalise(ex.answer)
      ? null
      : `expected ${ex.answer}, got ${result}`;
  }
  if (ex.type === "numeric" || ex.type === "estimation" || ex.type === "interactive") {
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return `expected a number in result, got ${JSON.stringify(result)}`;
    }
    const diff = Math.abs(result - ex.answer);
    return diff <= ex.tolerance
      ? null
      : `expected ${String(ex.answer)}, got ${String(result)} (tolerance ${String(ex.tolerance)})`;
  }
  return null; // other types have nothing numeric to verify
}

export function verifyExercises(
  exercises: readonly LoadedExercise[],
  run: Runner = pythonRunner,
): { checked: number; errors: string[] } {
  const errors: string[] = [];
  let checked = 0;
  for (const { file, exercise } of exercises) {
    if (!exercise.verify) continue;
    if (unseededRandomness(exercise)) {
      errors.push(`${file}: verify: uses randomness but params has no "seed"`);
      continue;
    }
    // The base version, then every variant with its own params and answer.
    const versions: { label: string; ex: Exercise }[] = [{ label: "", ex: exercise }];
    if ("variants" in exercise) {
      exercise.variants.forEach((v, i) => {
        versions.push({
          label: ` (variants[${String(i)}])`,
          ex: {
            ...exercise,
            params: { ...exercise.params, ...v.params },
            answer: v.answer,
          } as Exercise,
        });
      });
    }
    for (const { label, ex } of versions) {
      checked += 1;
      const out = run(harness(exercise.verify, ex.params));
      if (!out.ok) {
        errors.push(`${file}: verify${label}: ${out.error}`);
        continue;
      }
      const line = out.stdout.split("\n").find((l) => l.startsWith(MARK));
      if (!line) {
        errors.push(`${file}: verify${label}: produced no result`);
        continue;
      }
      const mismatch = compare(ex, JSON.parse(line.slice(MARK.length)) as unknown);
      if (mismatch) errors.push(`${file}: verify${label}: ${mismatch}`);
    }
    if ("random" in exercise && exercise.random) {
      checked += 1;
      errors.push(...randomParity(file, exercise, exercise.random, run));
    }
  }
  for (const { file, exercise } of exercises) errors.push(...mistakeErrors(file, exercise));
  return { checked, errors };
}

type Numeric = Exclude<Extract<Exercise, { tolerance: number }>, { type: "code" }>;
const numeric = (p: Exercise["params"]) =>
  Object.fromEntries(
    Object.entries(p).filter((e): e is [string, number] => typeof e[1] === "number"),
  );

/**
 * The TS formula (used for grading) and the Python verify must agree on PARITY_SEEDS
 * seeds; the first disagreement names its seed and params.
 */
function randomParity(
  file: string,
  ex: Numeric,
  spec: NonNullable<Numeric["random"]>,
  run: Runner,
): string[] {
  if (!ex.verify) return [];
  const sets = Array.from({ length: PARITY_SEEDS }, (_, seed) => ({
    seed,
    params: { ...ex.params, ...paramsFor(spec, seed) },
  }));
  const out = run(
    batchHarness(
      ex.verify,
      sets.map((s) => s.params),
    ),
  );
  if (!out.ok) return [`${file}: random parity: ${out.error}`];
  const results = out.stdout
    .split("\n")
    .filter((l) => l.startsWith(MARK))
    .map((l) => JSON.parse(l.slice(MARK.length)) as unknown);
  if (results.length !== sets.length) {
    return [
      `${file}: random parity: python produced ${String(results.length)} of ${String(sets.length)} results`,
    ];
  }
  for (const [i, { seed, params }] of sets.entries()) {
    const py = results[i];
    let ts: number;
    try {
      ts = formulaAnswer(spec.formula, numeric(params));
    } catch (e) {
      return [
        `${file}: random parity (seed ${String(seed)}): formula: ${e instanceof Error ? e.message : String(e)}`,
      ];
    }
    if (
      typeof py !== "number" ||
      !Number.isFinite(ts) ||
      !closeEnough(ts, py, ex.tolerance, ex.relTolerance)
    ) {
      return [
        `${file}: random parity (seed ${String(seed)}, params ${JSON.stringify(numeric(params))}): formula gives ${String(ts)}, verify gives ${JSON.stringify(py)}`,
      ];
    }
  }
  return [];
}

/** A listed mistake must never equal the correct answer (it would mark right as wrong). */
function mistakeErrors(file: string, ex: Exercise): string[] {
  if (!("mistakes" in ex) || ex.mistakes.length === 0) return [];
  const errors: string[] = [];
  if (ex.type === "symbolic") {
    ex.mistakes.forEach((m, i) => {
      try {
        if (typeof m.answer === "string" && symbolicSame(m.answer, ex.answer, numeric(ex.params)))
          errors.push(`${file}: mistakes[${String(i)}]: equals the correct answer`);
      } catch {
        /* parse errors are reported by the schema rules */
      }
    });
    return errors;
  }
  if (!("tolerance" in ex)) return [];
  // Every version a learner can get: the base, hand-written variants, random seeds.
  const versions: { label: string; params: Exercise["params"]; answer: number }[] = [
    { label: "", params: ex.params, answer: ex.answer },
    ...ex.variants.map((v, i) => ({
      label: ` (variants[${String(i)}])`,
      params: { ...ex.params, ...v.params },
      answer: v.answer,
    })),
  ];
  if (ex.random) {
    for (let seed = 0; seed < PARITY_SEEDS; seed++) {
      const params = { ...ex.params, ...paramsFor(ex.random, seed) };
      versions.push({
        label: ` (seed ${String(seed)})`,
        params,
        answer: formulaAnswer(ex.random.formula, numeric(params)),
      });
    }
  }
  ex.mistakes.forEach((m, i) => {
    for (const v of versions) {
      let value: number;
      try {
        value =
          typeof m.answer === "number"
            ? m.answer
            : evaluate(parseExpr(m.answer), numeric(v.params));
      } catch {
        return;
      }
      if (closeEnough(value, v.answer, ex.tolerance, ex.relTolerance)) {
        errors.push(`${file}: mistakes[${String(i)}]${v.label}: equals the correct answer`);
        return;
      }
    }
  });
  return errors;
}

function symbolicSame(a: string, b: string, fixed: Record<string, number>): boolean {
  return symbolicMatch(a, b, fixed) === true;
}
