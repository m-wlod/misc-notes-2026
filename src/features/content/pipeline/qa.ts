import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { parse } from "yaml";

import type { LoadedExercise } from "./load";

/**
 * `pnpm content:qa`: checks the content build can't express as a schema. Errors fail CI;
 * warnings and the level report are printed for the reviewer.
 */

export type LessonSource = {
  file: string;
  id: string;
  locale: string;
  status: string;
  sources: unknown[];
  body: string;
  isStub: boolean;
};

const STUB = /^\s*<Stub\s*\/>\s*$/;

function mdxFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return mdxFiles(path);
    return name.endsWith(".mdx") ? [path] : [];
  });
}

/** Lessons under `<root>/{pl,en}/tracks`, read from disk (front matter + raw body). */
export function loadLessonSources(root: string): LessonSource[] {
  return ["pl", "en"].flatMap((locale) =>
    mdxFiles(join(root, locale, "tracks")).map((path) => {
      const raw = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
      const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
      const front = (match ? parse(match[1] ?? "") : {}) as Record<string, unknown>;
      const body = match?.[2] ?? raw;
      return {
        file: relative(process.cwd(), path).replaceAll("\\", "/"),
        id: typeof front.id === "string" ? front.id : "",
        locale,
        status: typeof front.status === "string" ? front.status : "",
        sources: Array.isArray(front.sources) ? front.sources : [],
        body,
        isStub: STUB.test(body),
      };
    }),
  );
}

/** Internal link targets in MDX: markdown links and href attributes starting with "/". */
export function internalLinks(body: string): string[] {
  const md = [...body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1] ?? "");
  const attr = [...body.matchAll(/\bhref=["'](\/[^"']*)["']/g)].map((m) => m[1] ?? "");
  return [...md, ...attr].map((href) => href.split("#")[0] ?? "").filter(Boolean);
}

export type QaInput = {
  lessons: readonly LessonSource[];
  exercises: readonly LoadedExercise[];
  /** Is this internal path a real page? (routes, tracks, modules, lessons, glossary) */
  isPath: (path: string) => boolean;
  /** lesson id → module label for the level report. */
  moduleOf: (lessonId: string) => string | undefined;
};

export type QaResult = {
  errors: string[];
  warnings: string[];
  /** module label → exercise count per level 1–5. */
  levels: Record<string, [number, number, number, number, number]>;
};

export function qa({ lessons, exercises, isPath, moduleOf }: QaInput): QaResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lessonIds = new Set(lessons.map((l) => l.id));

  for (const lesson of lessons) {
    if (lesson.isStub) continue;
    if (lesson.locale === "pl" && lesson.sources.length === 0) {
      errors.push(`${lesson.file}: sources: a written lesson needs at least one source`);
    }
    for (const href of internalLinks(lesson.body)) {
      if (!isPath(href)) errors.push(`${lesson.file}: link: "${href}" is not a page on this site`);
    }
  }

  const levels: QaResult["levels"] = {};
  for (const { file, exercise } of exercises) {
    if (exercise.hints.length === 0) errors.push(`${file}: hints: add at least one hint`);
    if (!exercise.solution) errors.push(`${file}: solution: add a step-by-step solution`);
    for (const id of exercise.lessonIds) {
      if (!lessonIds.has(id)) errors.push(`${file}: lessonIds: unknown lesson "${id}"`);
    }
    // An answer printed in the lesson it practises makes the exercise pointless.
    if (
      "answer" in exercise &&
      (typeof exercise.answer === "number" || typeof exercise.answer === "string")
    ) {
      const text = String(exercise.answer);
      if (text.length >= 4) {
        for (const lesson of lessons) {
          if (exercise.lessonIds.includes(lesson.id) && lesson.body.includes(text)) {
            warnings.push(`${file}: answer "${text}" appears verbatim in ${lesson.file}`);
          }
        }
      }
    }
    const mod = moduleOf(exercise.lessonIds[0] ?? "") ?? "(outside the curriculum)";
    const row = (levels[mod] ??= [0, 0, 0, 0, 0]);
    row[exercise.level - 1] = (row[exercise.level - 1] ?? 0) + 1;
  }
  return { errors, warnings, levels };
}

/** The level report as text: one line per module, warning when a level is missing. */
export function levelReport(levels: QaResult["levels"]): string[] {
  return Object.entries(levels).map(([mod, counts]) => {
    const missing = counts.flatMap((n, i) => (n === 0 ? [i + 1] : []));
    return `${mod}: ${counts.map((n, i) => `L${String(i + 1)}=${String(n)}`).join(" ")}${
      missing.length > 0 ? `  (no exercises at level ${missing.join(", ")})` : ""
    }`;
  });
}
