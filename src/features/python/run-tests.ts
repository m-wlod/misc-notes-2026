import { getRuntime } from "./client";
import { emptyOutput, reduceOutput, type RunOutput } from "./protocol";

/**
 * Runs a code exercise's tests in the browser (Phase 13). Each test gets the learner's
 * code in a fresh namespace, so tests can't affect each other. The page shows pass/fail
 * per test with the exercise's own message; the server grades the counts plus the number
 * from `answerExpr` (see gradeCode).
 */
export type TestOutcome = {
  passed: boolean;
  message: string;
  /** For a crash (not a failed assert): the exception line, e.g. "NameError: …". */
  detail: string | null;
  timedOut: boolean;
};

export type SuiteResult =
  | { kind: "setup-error"; output: RunOutput }
  | { kind: "done"; outcomes: TestOutcome[]; value: number | null };

/** Last line of a traceback: the exception type and message. */
export function exceptionLine(error: string): string {
  return (
    error
      .trim()
      .split("\n")
      .filter((l) => l.trim())
      .at(-1) ?? error
  );
}

/** What one test run means: an assert failing is a plain fail; anything else is a crash. */
export function outcomeOf(out: RunOutput, message: string): TestOutcome {
  if (out.status === "done") return { passed: true, message, detail: null, timedOut: false };
  const timedOut = out.stopped === "timeout";
  const line = out.error ? exceptionLine(out.error) : null;
  const detail = timedOut || !line || /^AssertionError\b/.test(line) ? null : line;
  return { passed: false, message, detail, timedOut };
}

/** Reads `float(...)`'s repr; null when it isn't a finite number. */
export function readValue(repr: string | null): number | null {
  if (repr === null) return null;
  const v = Number(repr.trim());
  return Number.isFinite(v) ? v : null;
}

export function runOnce(
  code: string,
  opts: { ns: string; fresh?: boolean; timeoutMs?: number; lang: "pl" | "en" },
): Promise<RunOutput> {
  const rt = getRuntime();
  rt.warm(opts.lang);
  let out = emptyOutput();
  const { done } = rt.run(code, {
    ns: opts.ns,
    fresh: opts.fresh ?? true,
    ...(opts.timeoutMs === undefined ? {} : { timeoutMs: opts.timeoutMs }),
    emit: (ev) => {
      out = reduceOutput(out, ev);
    },
  });
  return done.then(() => out);
}

export async function runSuite(
  code: string,
  tests: { code: string; message: string }[],
  answerExpr: string | null,
  opts: { ns: string; lang: "pl" | "en"; onProgress?: (done: number) => void },
): Promise<SuiteResult> {
  const base = { ns: opts.ns, lang: opts.lang };
  const setup = await runOnce(code, base);
  if (setup.status !== "done") return { kind: "setup-error", output: setup };
  const outcomes: TestOutcome[] = [];
  for (const t of tests) {
    outcomes.push(outcomeOf(await runOnce(`${code}\n\n${t.code}`, base), t.message));
    opts.onProgress?.(outcomes.length);
  }
  let value: number | null = null;
  if (answerExpr) {
    const out = await runOnce(`${code}\n\nfloat(${answerExpr})`, base);
    value = out.status === "done" ? readValue(out.value) : null;
  }
  return { kind: "done", outcomes, value };
}
