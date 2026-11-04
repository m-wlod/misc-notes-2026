/**
 * Phase 20c: every public content page is prerendered (static, or a static shell with
 * streamed parts). Reads the build's prerender manifest after `pnpm build` and fails if a
 * section page, track, module, lesson, simulation or interview type is missing, or if any
 * prerendered page needs a full server render. Run in CI after the build.
 *
 *   pnpm build && pnpm check:static
 */
import { readdirSync, readFileSync } from "node:fs";

import { curriculum } from "../content/curriculum";

type Route = { renderingMode?: string };
const dist = process.env.NEXT_DIST_DIR ?? ".next";
const manifest = JSON.parse(readFileSync(`${dist}/prerender-manifest.json`, "utf8")) as {
  routes: Record<string, Route>;
};
const routes = Object.keys(manifest.routes);
const problems: string[] = [];

// Internal pathnames (the manifest keys), not the localized URLs.
const SECTIONS = [
  "",
  "/learn",
  "/textbook",
  "/map",
  "/practice",
  "/interview",
  "/interview/roadmap",
  "/debunk",
  "/glossary",
  "/lab",
  "/lab/notebook",
  "/links",
  "/about",
  "/privacy",
  "/terms",
  "/cookies",
  "/disclaimer",
];

const modules = curriculum.flatMap((t) => t.modules);
const lessons = modules.flatMap((m) => m.lessons);
const sims = readdirSync("src/features/sims/defs").filter((f) => f.endsWith(".ts")).length;
const INTERVIEW_TYPES = 5;

const depth = (prefix: string, n: number) =>
  routes.filter((r) => r.startsWith(`${prefix}/`) && r.split("/").length === n).length;

for (const locale of ["pl", "en"]) {
  for (const s of SECTIONS) {
    if (!manifest.routes[`/${locale}${s}`]) problems.push(`not prerendered: /${locale}${s}`);
  }
  const learn = `/${locale}/learn`;
  const expect = (what: string, got: number, want: number) => {
    if (got < want)
      problems.push(`${locale}: ${what} prerendered ${String(got)} of ${String(want)}`);
  };
  expect("tracks", depth(learn, 4), curriculum.length);
  expect("modules", depth(learn, 5), modules.length);
  expect("lessons", depth(learn, 6), lessons.length);
  expect("simulations", depth(`/${locale}/lab/sims`, 5), sims);
  expect(
    "interview types",
    routes.filter(
      (r) =>
        r.startsWith(`/${locale}/interview/`) &&
        r.split("/").length === 4 &&
        !/\/(history|roadmap)$/.test(r),
    ).length,
    INTERVIEW_TYPES,
  );
}

const MODES = new Set(["STATIC", "PARTIALLY_STATIC"]);
for (const [path, r] of Object.entries(manifest.routes)) {
  if (r.renderingMode && !MODES.has(r.renderingMode)) {
    problems.push(`${path}: rendering mode ${r.renderingMode}`);
  }
}

if (problems.length > 0) {
  console.error(`check:static: ${String(problems.length)} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `check:static ok: ${String(routes.length)} prerendered pages; per language ${String(curriculum.length)} tracks, ${String(modules.length)} modules, ${String(lessons.length)} lessons, ${String(sims)} simulations, ${String(INTERVIEW_TYPES)} interview types and ${String(SECTIONS.length)} section pages`,
);
