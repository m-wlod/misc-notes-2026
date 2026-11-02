// pnpm content:verify [--root <content-root>]
// Runs every exercise's Python `verify` block and compares it with the stored answer, and
// checks code exercises (reference solution passes, starter fails, answer matches).
import { loadExercises } from "@/features/content/pipeline/load";
import { PYTHON, verifyExercises } from "@/features/content/pipeline/verify";
import { verifyCodeExercises } from "@/features/content/pipeline/verify-code";

const rootFlag = process.argv.indexOf("--root");
const root = rootFlag === -1 ? "content" : (process.argv[rootFlag + 1] ?? "content");

const { exercises, errors: loadErrors } = loadExercises(root);
const computed = verifyExercises(exercises);
const code = verifyCodeExercises(exercises);
const checked = computed.checked + code.checked;
const all = [...loadErrors, ...computed.errors, ...code.errors];

if (all.length > 0) {
  console.error(
    `content:verify failed (${String(all.length)}):\n${all.map((e) => `  - ${e}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `content:verify ok: ${String(checked)} verify block(s) checked with ${PYTHON}, ${String(exercises.length)} exercise(s) in ${root}/exercises`,
);
