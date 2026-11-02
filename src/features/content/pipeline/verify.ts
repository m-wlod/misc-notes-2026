import { spawnSync } from "node:child_process";

import type { Exercise } from "@/features/exercises/schema";

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

export type RunResult = { ok: true; stdout: string } | { ok: false; error: string };
export type Runner = (program: string) => RunResult;

export const PYTHON = process.platform === "win32" ? "python" : "python3";

/** Runs a program with real Python: `-I` (isolated: no user site, no cwd on sys.path). */
export const pythonRunner: Runner = (program) => {
  const r = spawnSync(PYTHON, ["-I", "-c", program], { encoding: "utf8", timeout: TIMEOUT_MS });
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code;
    return {
      ok: false,
      error:
        code === "ETIMEDOUT" ? `timed out after ${String(TIMEOUT_MS / 1000)} s` : r.error.message,
    };
  }
  if (r.status !== 0) {
    const last = r.stderr.trim().split("\n").at(-1) ?? "failed";
    return { ok: false, error: `python error: ${last}` };
  }
  return { ok: true, stdout: r.stdout };
};

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
  }
  return { checked, errors };
}
