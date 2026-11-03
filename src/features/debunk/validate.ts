/**
 * Rules for Debunk Lab entries beyond their shape (Phase 16), run at content build:
 * one id per locale, the Polish entry exists for every translation, the file sits in its
 * locale's folder, related lessons exist. Source dates and archive links are required by
 * the schema itself (CONTENT_GUIDE: public claims are cited with a date and an archive).
 */
export type EntryRef = {
  id: string;
  slug: string;
  locale: "pl" | "en";
  file: string;
  relatedLessons: readonly string[];
};

export function validateDebunk(
  entries: readonly EntryRef[],
  lessonIds: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  const slugs = new Map<string, string>();
  const polish = new Set(entries.filter((e) => e.locale === "pl").map((e) => e.id));
  for (const e of entries) {
    const key = `${e.locale}:${e.id}`;
    const first = seen.get(key);
    if (first) errors.push(`${e.file}: id: "${e.id}" is already used by ${first}`);
    else seen.set(key, e.file);
    const slugKey = `${e.locale}:${e.slug}`;
    const slugFirst = slugs.get(slugKey);
    if (slugFirst) errors.push(`${e.file}: slug: "${e.slug}" is already used by ${slugFirst}`);
    else slugs.set(slugKey, e.file);
    const folder = /(?:^|\/)(pl|en)\/debunk\//.exec(e.file)?.[1];
    if (folder && folder !== e.locale) {
      errors.push(`${e.file}: locale: "${e.locale}" but the file is in content/${folder}/`);
    }
    if (e.locale === "en" && !polish.has(e.id)) {
      errors.push(`${e.file}: id: no Polish entry with id "${e.id}" (Polish is the source)`);
    }
    for (const l of e.relatedLessons) {
      if (!lessonIds.has(l)) errors.push(`${e.file}: relatedLessons: no lesson "${l}"`);
    }
  }
  return errors;
}
