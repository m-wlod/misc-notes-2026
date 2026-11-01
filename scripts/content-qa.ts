// pnpm content:qa [--root <content-root>]
// Checks what the content build cannot: sources, hints, solutions, lesson links, internal links.
import { loadExercises } from "@/features/content/pipeline/load";
import { levelReport, loadLessonSources, qa } from "@/features/content/pipeline/qa";
import { routing } from "@/i18n/routing";

import { curriculum } from "../content/curriculum";

const rootFlag = process.argv.indexOf("--root");
const root = rootFlag === -1 ? "content" : (process.argv[rootFlag + 1] ?? "content");

const lessons = loadLessonSources(root);
const { exercises, errors: loadErrors } = loadExercises(root);

// Every public page path: static routes, tracks and modules (per-locale slugs).
const paths = new Set<string>();
for (const locale of routing.locales) {
  for (const value of Object.values(routing.pathnames)) {
    const path = typeof value === "string" ? value : value[locale];
    if (!path.includes("[")) paths.add(`/${locale}${path === "/" ? "" : path}`);
  }
  const learn = routing.pathnames["/learn"][locale];
  for (const track of curriculum) {
    paths.add(`/${locale}${learn}/${track.slug[locale]}`);
    for (const mod of track.modules) {
      paths.add(`/${locale}${learn}/${track.slug[locale]}/${mod.slug[locale]}`);
    }
  }
}
// Lesson pages: /<locale>/<learn>/<track>/<module>/<lesson>, with a known track and module.
const isPath = (p: string) => {
  const clean = p.replace(/\/$/, "");
  if (paths.has(clean)) return true;
  const parent = clean.split("/").slice(0, -1).join("/");
  return /^\/(pl|en)\/(nauka|learn)\/[^/]+\/[^/]+\/[^/]+$/.test(clean) && paths.has(parent);
};
const moduleOf = (lessonId: string) => {
  for (const track of curriculum) {
    for (const mod of track.modules) {
      if (mod.lessons.includes(lessonId)) return `${track.name.pl} · ${mod.name.pl}`;
    }
  }
  return undefined;
};

const result = qa({ lessons, exercises, isPath, moduleOf });
const errors = [...loadErrors, ...result.errors];
for (const w of result.warnings) console.warn(`warning: ${w}`);
const report = levelReport(result.levels);
if (report.length > 0) {
  console.log(`Exercises per level:\n${report.map((l) => `  ${l}`).join("\n")}`);
}
if (errors.length > 0) {
  console.error(
    `content:qa failed (${String(errors.length)}):\n${errors.map((e) => `  - ${e}`).join("\n")}`,
  );
  process.exit(1);
}
const written = lessons.filter((l) => !l.isStub).length;
console.log(
  `content:qa ok: ${String(lessons.length)} lesson file(s) (${String(written)} written), ${String(exercises.length)} exercise(s)`,
);
