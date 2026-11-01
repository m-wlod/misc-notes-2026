import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { parse } from "yaml";

import { exerciseRuleErrors, exerciseSchema, type Exercise } from "@/features/exercises/schema";

/**
 * Loads exercise YAML from a content root (real `content/` or a test fixture) with the
 * same schema and rules the content build uses. Errors read `file: field: reason`.
 */
export type LoadedExercise = { file: string; exercise: Exercise };

function yamlFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return yamlFiles(path);
    return /\.ya?ml$/.test(name) ? [path] : [];
  });
}

const rel = (path: string) => relative(process.cwd(), path).replaceAll("\\", "/");

export function loadExercises(root: string): { exercises: LoadedExercise[]; errors: string[] } {
  const exercises: LoadedExercise[] = [];
  const errors: string[] = [];
  for (const path of yamlFiles(join(root, "exercises"))) {
    const file = rel(path);
    let data: unknown;
    try {
      data = parse(readFileSync(path, "utf8"));
    } catch (e) {
      errors.push(`${file}: yaml: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      continue;
    }
    const parsed = exerciseSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${file}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      continue;
    }
    for (const e of exerciseRuleErrors(parsed.data)) errors.push(`${file}: ${e}`);
    exercises.push({ file, exercise: parsed.data });
  }
  const seen = new Map<string, string>();
  for (const { file, exercise } of exercises) {
    const first = seen.get(exercise.id);
    if (first) errors.push(`${file}: id: "${exercise.id}" is already used by ${first}`);
    else seen.set(exercise.id, file);
  }
  return { exercises, errors };
}
