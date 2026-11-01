import { relative } from "node:path";

import rehypeShiki from "@shikijs/rehype";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkMath from "remark-math";
import { createCssVariablesTheme } from "shiki";
import { defineCollection, defineConfig, s } from "velite";

import { rehypeNumbering } from "./src/features/content/rehype-numbering";
import { termRefsIn, validateContent } from "./src/features/content/validate";

/**
 * Content layer (Phase 4). `pnpm content:build` compiles content/ into typed data in
 * .velite/ (imported as `#content`). Strict: invalid frontmatter or a broken cross-file
 * reference fails the build with `file: field: reason` lines.
 *
 * CONTENT_ROOT / CONTENT_OUT exist only so tests can build the invalid fixtures into a
 * temporary folder without touching the real .velite/ output.
 */

const fileOf = (absolute: string) => relative(process.cwd(), absolute).replaceAll("\\", "/");

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
    })
    .strict()
    .transform((data, { meta }) => ({
      ...data,
      file: fileOf(meta.path),
      termRefs: termRefsIn(meta.content ?? ""),
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

export default defineConfig({
  root: process.env.CONTENT_ROOT ?? "content",
  strict: true,
  output: {
    data: process.env.CONTENT_OUT ?? ".velite",
    assets: process.env.CONTENT_OUT ? `${process.env.CONTENT_OUT}/assets` : "public/static",
    base: "/static/",
    clean: true,
  },
  collections: { lessons, glossary },
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
  prepare: ({ lessons, glossary }) => {
    const errors = lessons.flatMap((l) => {
      const folder = /(?:^|\/)(pl|en)\/tracks\//.exec(l.file)?.[1];
      return folder && folder !== l.locale
        ? [`${l.file}: locale: "${l.locale}" but the file is in content/${folder}/`]
        : [];
    });
    errors.push(...validateContent(lessons, glossary));
    if (errors.length > 0) {
      throw new Error(
        `Invalid content (${String(errors.length)}):\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
  },
});
