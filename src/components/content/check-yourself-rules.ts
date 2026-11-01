import { parseLocaleNumber } from "@/lib/math/parse-number";

/**
 * <CheckYourself> props: either multiple choice (`options` + the index of the right one
 * in `answer`) or a number (`answer` as text, e.g. "0.5", with an optional `tolerance`).
 * Ungraded and recorded nowhere, so the answer may ship to the browser (CLAUDE.md).
 */
export type CheckProps = {
  options?: readonly string[];
  answer: number | string;
  tolerance?: number;
  explanation?: string;
};

export type Check =
  | { kind: "choice"; options: readonly string[]; correct: number }
  | { kind: "number"; value: number; tolerance: number; display: string };

/** Throws on invalid props, so a broken question fails the page build, not the reader. */
export function toCheck(props: CheckProps): Check {
  if (props.options) {
    const correct = Number(props.answer);
    if (props.options.length < 2) throw new Error("CheckYourself: give at least 2 options");
    if (!Number.isInteger(correct) || correct < 0 || correct >= props.options.length) {
      throw new Error(
        `CheckYourself: answer must be an option index 0–${String(props.options.length - 1)}`,
      );
    }
    return { kind: "choice", options: props.options, correct };
  }
  const parsed = parseLocaleNumber(String(props.answer));
  if (!parsed.ok)
    throw new Error(`CheckYourself: answer "${String(props.answer)}" is not a number`);
  const tolerance = props.tolerance ?? Math.max(1e-9, Math.abs(parsed.value) * 1e-6);
  if (!(tolerance >= 0)) throw new Error("CheckYourself: tolerance must be ≥ 0");
  return { kind: "number", value: parsed.value, tolerance, display: String(props.answer) };
}

/** Is the learner's raw answer right? Accepts "0,5", "0.5", "1/2", "50%". */
export function isCorrect(check: Check, raw: string): boolean {
  if (check.kind === "choice") return Number(raw) === check.correct;
  const parsed = parseLocaleNumber(raw);
  return parsed.ok && Math.abs(parsed.value - check.value) <= check.tolerance;
}
