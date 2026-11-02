import path from "node:path";

import type { Exercise } from "@/features/exercises/schema";
import { closeEnough } from "@/features/grading/rules";

import type { LoadedExercise } from "./load";
import { pythonWithPackagesRunner, type Runner } from "./verify";

/**
 * Code exercises (Phase 13), checked by `pnpm content:verify` with real Python:
 * the reference solution passes every hidden test and the visible examples, the starter
 * code fails at least one test (so the tests test something), and `answerExpr` on the
 * reference solution equals the stored `answer`.
 */
type CodeExercise = Extract<Exercise, { type: "code" }>;
const MARK = "__QLA_CODE__";

/**
 * `qla` as in the browser lab, minus plots: `load` reads the same generated CSV from
 * public/datasets, `show` and `hist` do nothing.
 */
const shim = (datasets: string) => `
class _Qla:
    @staticmethod
    def load(name):
        import pandas as pd
        return pd.read_csv(${JSON.stringify(datasets)} + "/" + name + ".csv", parse_dates=["date"], index_col="date")
    @staticmethod
    def show(*args, **kwargs):
        pass
    @staticmethod
    def hist(*args, **kwargs):
        pass
qla = _Qla()
`;

/** Runs `code`, then each test in its own copy of the namespace; prints a JSON report. */
export function codeHarness(
  code: string,
  ex: Pick<CodeExercise, "tests" | "examples" | "answerExpr">,
  datasets = path.resolve("public", "datasets").replaceAll("\\", "/"),
): string {
  const tests = ex.tests.map((t) => t.code);
  if (ex.examples.trim()) tests.push(ex.examples);
  return [
    "import json as __json, copy as __copy",
    shim(datasets),
    "__ns = {'__name__': '__main__', 'qla': qla, 'show': qla.show, 'hist': qla.hist}",
    "__report = {'error': None, 'fails': [], 'answer': None}",
    "try:",
    `    exec(compile(${JSON.stringify(code)}, "<code>", "exec"), __ns)`,
    "except BaseException as __e:",
    "    __report['error'] = type(__e).__name__ + ': ' + str(__e)",
    "if __report['error'] is None:",
    `    for __i, __t in enumerate(__json.loads(${JSON.stringify(JSON.stringify(tests))})):`,
    "        try:",
    "            exec(compile(__t, '<test>', 'exec'), dict(__ns))",
    "        except BaseException as __e:",
    "            __report['fails'].append([__i, type(__e).__name__ + ': ' + str(__e)])",
    ...(ex.answerExpr
      ? [
          "    try:",
          `        __report['answer'] = float(eval(${JSON.stringify(ex.answerExpr)}, dict(__ns)))`,
          "    except BaseException as __e:",
          "        __report['error'] = 'answerExpr: ' + type(__e).__name__ + ': ' + str(__e)",
        ]
      : []),
    `print(${JSON.stringify(MARK)} + __json.dumps(__report))`,
  ].join("\n");
}

type Report = { error: string | null; fails: [number, string][]; answer: number | null };

function report(run: Runner, program: string): Report | string {
  const out = run(program);
  if (!out.ok) {
    return /No module named '(numpy|pandas)'/.test(out.error)
      ? `${out.error} (install them: python -m pip install numpy pandas)`
      : out.error;
  }
  const line = out.stdout.split("\n").find((l) => l.startsWith(MARK));
  return line ? (JSON.parse(line.slice(MARK.length)) as Report) : "produced no report";
}

export function verifyCodeExercises(
  exercises: readonly LoadedExercise[],
  run: Runner = pythonWithPackagesRunner,
): { checked: number; errors: string[] } {
  const errors: string[] = [];
  let checked = 0;
  for (const { file, exercise: ex } of exercises) {
    if (ex.type !== "code") continue;
    checked += 1;
    const label = (i: number) => (i < ex.tests.length ? `tests[${String(i)}]` : "examples");

    const ref = report(run, codeHarness(ex.solutionCode, ex));
    if (typeof ref === "string") {
      errors.push(`${file}: solutionCode: ${ref}`);
      continue;
    }
    if (ref.error) errors.push(`${file}: solutionCode: ${ref.error}`);
    for (const [i, why] of ref.fails) {
      errors.push(`${file}: solutionCode fails ${label(i)}: ${why}`);
    }
    if (ex.answer !== undefined) {
      if (ref.answer === null || !Number.isFinite(ref.answer)) {
        if (!ref.error) errors.push(`${file}: answerExpr: produced no number`);
      } else if (!closeEnough(ref.answer, ex.answer, ex.tolerance, ex.relTolerance)) {
        errors.push(
          `${file}: answerExpr: expected ${String(ex.answer)}, got ${String(ref.answer)} (tolerance ${String(ex.tolerance)})`,
        );
      }
    }

    const starter = report(run, codeHarness(ex.starter, { ...ex, answerExpr: undefined }));
    if (typeof starter === "string") {
      errors.push(`${file}: starter: ${starter}`);
    } else if (!starter.error && starter.fails.filter(([i]) => i < ex.tests.length).length === 0) {
      errors.push(`${file}: starter: passes every hidden test, so the tests check nothing`);
    }
  }
  return { checked, errors };
}
