/**
 * Cross-file content checks that a per-file schema can't do. Run by Velite's `prepare`
 * hook, so any problem fails `pnpm build` with one readable line per error:
 *   content/pl/tracks/x/y.mdx: prerequisites[1]: unknown lesson id "foo"
 */

export type LessonRef = {
  /** Path relative to the repo root, e.g. "content/pl/tracks/x/y.mdx". */
  file: string;
  id: string;
  locale: "pl" | "en";
  prerequisites: readonly string[];
  glossaryTerms: readonly string[];
  /** `<Term id="…">` ids used in the body. */
  termRefs: readonly string[];
};

export type GlossaryRef = { file: string; id: string; lesson?: string | undefined };

export function validateContent(
  lessons: readonly LessonRef[],
  glossary: readonly GlossaryRef[],
): string[] {
  const errors: string[] = [];
  const polish = new Map<string, LessonRef>();
  const seen = new Map<string, string>(); // `${locale}:${id}` → file
  const termIds = new Set<string>();

  for (const lesson of lessons) {
    const key = `${lesson.locale}:${lesson.id}`;
    const first = seen.get(key);
    if (first) {
      errors.push(`${lesson.file}: id: "${lesson.id}" is already used by ${first}`);
    } else {
      seen.set(key, lesson.file);
    }
    if (lesson.locale === "pl" && !polish.has(lesson.id)) polish.set(lesson.id, lesson);
  }

  for (const term of glossary) {
    if (termIds.has(term.id)) errors.push(`${term.file}: id: duplicate glossary id "${term.id}"`);
    termIds.add(term.id);
  }

  for (const lesson of lessons) {
    if (lesson.locale !== "pl" && !polish.has(lesson.id)) {
      errors.push(
        `${lesson.file}: id: translation of "${lesson.id}" has no Polish original (translations share the Polish file's id)`,
      );
    }
    lesson.prerequisites.forEach((p, i) => {
      if (p === lesson.id) {
        errors.push(`${lesson.file}: prerequisites[${String(i)}]: a lesson can't require itself`);
      } else if (!polish.has(p)) {
        errors.push(`${lesson.file}: prerequisites[${String(i)}]: unknown lesson id "${p}"`);
      }
    });
    lesson.glossaryTerms.forEach((t, i) => {
      if (!termIds.has(t)) {
        errors.push(`${lesson.file}: glossaryTerms[${String(i)}]: unknown glossary term "${t}"`);
      }
    });
    for (const t of new Set(lesson.termRefs)) {
      if (!termIds.has(t)) errors.push(`${lesson.file}: <Term id="${t}">: unknown glossary term`);
    }
  }

  for (const term of glossary) {
    if (term.lesson && !polish.has(term.lesson)) {
      errors.push(`${term.file}: lesson: unknown lesson id "${term.lesson}"`);
    }
  }

  errors.push(...findCycles([...polish.values()]));
  return errors;
}

/** Prerequisite cycles among Polish lessons (the canonical graph), reported once each. */
function findCycles(lessons: readonly LessonRef[]): string[] {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const state = new Map<string, "visiting" | "done">();
  const errors: string[] = [];

  const visit = (id: string, stack: string[]) => {
    const s = state.get(id);
    if (s === "done") return;
    if (s === "visiting") {
      const cycle = [...stack.slice(stack.indexOf(id)), id];
      const file = byId.get(id)?.file ?? id;
      errors.push(`${file}: prerequisites: cycle ${cycle.join(" → ")}`);
      return;
    }
    state.set(id, "visiting");
    for (const p of byId.get(id)?.prerequisites ?? []) {
      if (byId.has(p)) visit(p, [...stack, id]);
    }
    state.set(id, "done");
  };

  for (const id of [...byId.keys()].sort()) visit(id, []);
  return errors;
}

/** `<Term id="…">` ids in an MDX source (attribute order and quotes may vary). */
export function termRefsIn(source: string): string[] {
  return [...source.matchAll(/<Term\b[^>]*?\bid=["']([^"']+)["']/g)].flatMap((m) =>
    m[1] ? [m[1]] : [],
  );
}
