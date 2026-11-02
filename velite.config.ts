import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import rehypeShiki from "@shikijs/rehype";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkMath from "remark-math";
import { createCssVariablesTheme } from "shiki";
import { defineCollection, defineConfig, s } from "velite";

import { curriculum } from "./content/curriculum";
import { rehypeNumbering } from "./src/features/content/rehype-numbering";
import { termRefsIn, validateContent, validateCurriculum } from "./src/features/content/validate";
import { validateExercises } from "./src/features/exercises/validate";
import { lessonCards } from "./src/features/review/cards";
import { buildSearchDocs } from "./src/features/search/docs";
import { routing } from "./src/i18n/routing";

/**
 * Content layer (Phase 4). `pnpm content:build` compiles content/ into typed data in
 * .velite/ (imported as `#content`). Strict: invalid frontmatter or a broken cross-file
 * reference fails the build with `file: field: reason` lines.
 *
 * CONTENT_ROOT / CONTENT_OUT exist only so tests can build the invalid fixtures into a
 * temporary folder without touching the real .velite/ output.
 */

const fileOf = (absolute: string) => relative(process.cwd(), absolute).replaceAll("\\", "/");

/**
 * The outline to validate: content/curriculum.ts normally. A test fixture root may bring
 * its own curriculum.json; without one, fixtures skip the curriculum checks.
 */
function curriculumOutline(): unknown {
  const root = process.env.CONTENT_ROOT;
  if (!root) return curriculum;
  const file = join(root, "curriculum.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as unknown) : null;
}

/** Shiki colours come from CSS variables in src/styles/tokens.css, so they follow the theme. */
const codeTheme = createCssVariablesTheme({ name: "qla", variablePrefix: "--code-" });

const id = s
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase-kebab-case (a–z, 0–9, hyphens)");

const lessons = defineCollection({
  name: "Lesson",
  pattern: ["pl/tracks/**/*.mdx", "en/tracks/**/*.mdx"],
  schema: s
    .object({
      id,
      slug: id,
      locale: s.enum(["pl", "en"]),
      title: s.string().min(3).max(120),
      summary: s.string().min(10).max(300),
      level: s.number().int().min(1).max(5),
      prerequisites: s.array(id).default([]),
      estimatedMinutes: s.number().int().min(1).max(120),
      status: s.enum(["draft", "review", "published"]),
      /** Shown as a "sample" banner; only placeholder lessons set it (Phases 4–6). */
      sample: s.boolean().default(false),
      sources: s
        .array(
          s.object({
            book: s.string(),
            chapter: s.string().optional(),
            page: s.union([s.number().int(), s.string()]).optional(),
          }),
        )
        .default([]),
      relatedVideos: s.array(s.object({ title: s.string(), url: s.string().url() })).default([]),
      glossaryTerms: s.array(id).default([]),
      body: s.mdx(),
      /** h2/h3 headings with their anchor ids, for the reader's table of contents. */
      toc: s.toc({ maxDepth: 3 }),
    })
    .strict()
    .transform((data, { meta }) => ({
      ...data,
      file: fileOf(meta.path),
      termRefs: termRefsIn(meta.content ?? ""),
      /** Shows the depth toggle only on lessons that have <Depth> passages. */
      hasDepth: /<Depth\b/.test(meta.content ?? ""),
      /** Body is just <Stub />: listed in the curriculum, shown as "in preparation". */
      isStub: /^\s*<Stub\s*\/>\s*$/.test(meta.content ?? ""),
      /** Definitions and key formulas, as spaced-review cards (Phase 15). */
      reviewCards: lessonCards(data.id, meta.content ?? ""),
      /** Plain text for the search index (headings, prose, math source). */
      text: (meta.plain ?? "").replaceAll(/\s+/g, " ").trim().slice(0, 4000),
    })),
});

const localized = s.object({ pl: s.string().min(1), en: s.string().min(1) }).strict();

const glossary = defineCollection({
  name: "GlossaryTerm",
  pattern: "glossary/*.yaml",
  schema: s
    .object({
      id,
      name: localized,
      definition: localized,
      lesson: id.optional(),
      sample: s.boolean().default(false),
    })
    .strict()
    .transform((data, { meta }) => ({ ...data, file: fileOf(meta.path) })),
});

/**
 * Exercises (Phase 7 format, Phase 8 renderers). Velite only collects the YAML; the
 * shape and rules come from src/features/exercises/schema.ts (Zod 4), applied in
 * `prepare` so the build and `pnpm content:verify` share one definition.
 * Server-only data: answers are graded on the server and never shipped to the browser.
 */
const exercises = defineCollection({
  name: "ExerciseFile",
  pattern: "exercises/**/*.yaml",
  schema: s
    .object({})
    .passthrough()
    .transform((data, { meta }) => ({ data: data as unknown, file: fileOf(meta.path) })),
});

/**
 * Weekly challenges (Phase 15): content/challenges/<yyyy-mm-dd>.yaml, named after the
 * week's Monday (Warsaw). A harder, open problem; solutions are moderated (Phase 17).
 */
const challenges = defineCollection({
  name: "Challenge",
  pattern: "challenges/*.yaml",
  schema: s
    .object({
      id,
      /** The Monday of the challenge's week (league weeks, Europe/Warsaw). */
      week: s.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      /** Solutions close at this instant (ISO, with offset). */
      deadline: s.string().datetime({ offset: true }),
      title: localized,
      prompt: localized,
      rubric: s.array(localized).min(1),
      status: s.enum(["draft", "published"]),
    })
    .strict(),
});

export default defineConfig({
  root: process.env.CONTENT_ROOT ?? "content",
  strict: true,
  output: {
    data: process.env.CONTENT_OUT ?? ".velite",
    assets: process.env.CONTENT_OUT ? `${process.env.CONTENT_OUT}/assets` : "public/static",
    base: "/static/",
    clean: true,
  },
  collections: { lessons, glossary, exercises, challenges },
  mdx: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      rehypeNumbering,
      // MathML for screen readers plus KaTeX HTML for the visuals; no client-side JS.
      [rehypeKatex, { output: "htmlAndMathml", throwOnError: true, strict: "error" }],
      rehypeSlug,
      [rehypeShiki, { theme: codeTheme, langs: ["python", "typescript", "bash", "text"] }],
    ],
  },
  /** Search indexes (public/search/<locale>.json), loaded by the search dialog on demand. */
  complete: ({ lessons, glossary }) => {
    if (process.env.CONTENT_ROOT) return;
    const paths = {
      learn: routing.pathnames["/learn"],
      glossary: routing.pathnames["/glossary"],
    };
    // id → slug per locale, for proxy.ts (lesson-level slug redirects) without the bodies.
    const slugs: Record<string, Partial<Record<string, string>>> = {};
    for (const l of lessons) slugs[l.id] = { ...slugs[l.id], [l.locale]: l.slug };
    writeFileSync(".velite/lesson-slugs.json", JSON.stringify(slugs));
    mkdirSync("public/search", { recursive: true });
    for (const locale of routing.locales) {
      const docs = buildSearchDocs(locale, curriculum, lessons, glossary, paths);
      writeFileSync(`public/search/${locale}.json`, JSON.stringify(docs));
    }
  },
  prepare: ({ lessons, glossary, exercises: exerciseFiles }) => {
    const errors = lessons.flatMap((l) => {
      const folder = /(?:^|\/)(pl|en)\/tracks\//.exec(l.file)?.[1];
      return folder && folder !== l.locale
        ? [`${l.file}: locale: "${l.locale}" but the file is in content/${folder}/`]
        : [];
    });
    errors.push(...validateContent(lessons, glossary));
    errors.push(...validateExercises(exerciseFiles, lessons));
    const outline = curriculumOutline();
    if (outline !== null) errors.push(...validateCurriculum(outline, lessons));
    if (errors.length > 0) {
      throw new Error(
        `Invalid content (${String(errors.length)}):\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  },
});
