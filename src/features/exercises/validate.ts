import { exerciseRuleErrors, exerciseSchema } from "./schema";

/**
 * Content-build checks for exercise files: schema, per-exercise rules, unique ids and
 * that every `lessonIds` entry is a real lesson. One `file: field: reason` line each.
 */
export function validateExercises(
  files: readonly { file: string; data: unknown }[],
  lessons: readonly { id: string }[],
): string[] {
  const errors: string[] = [];
  const lessonIds = new Set(lessons.map((l) => l.id));
  const seen = new Map<string, string>();
  for (const { file, data } of files) {
    const parsed = exerciseSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${file}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      continue;
    }
    const ex = parsed.data;
    errors.push(...exerciseRuleErrors(ex).map((e) => `${file}: ${e}`));
    const first = seen.get(ex.id);
    if (first) errors.push(`${file}: id: "${ex.id}" is already used by ${first}`);
    else seen.set(ex.id, file);
    ex.lessonIds.forEach((id, i) => {
      if (!lessonIds.has(id))
        errors.push(`${file}: lessonIds[${String(i)}]: unknown lesson "${id}"`);
    });
  }
  return errors;
}
