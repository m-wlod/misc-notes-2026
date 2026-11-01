import { describe, expect, it } from "vitest";

import {
  termRefsIn,
  validateContent,
  validateCurriculum,
  type GlossaryRef,
  type LessonRef,
} from "./validate";

const lesson = (id: string, extra: Partial<LessonRef> = {}): LessonRef => ({
  file: `content/pl/tracks/t/${id}.mdx`,
  id,
  locale: "pl",
  prerequisites: [],
  glossaryTerms: [],
  termRefs: [],
  ...extra,
});
const term = (id: string, extra: Partial<GlossaryRef> = {}): GlossaryRef => ({
  file: `content/glossary/${id}.yaml`,
  id,
  ...extra,
});

describe("validateContent", () => {
  it("accepts a consistent set", () => {
    const lessons = [
      lesson("a"),
      lesson("b", { prerequisites: ["a"], glossaryTerms: ["ev"], termRefs: ["ev"] }),
      lesson("b", { locale: "en", file: "content/en/tracks/t/b.mdx" }),
    ];
    expect(validateContent(lessons, [term("ev", { lesson: "b" })])).toEqual([]);
  });

  it("reports each problem as file: field: reason", () => {
    const errors = validateContent(
      [
        lesson("a"),
        lesson("a", { file: "content/pl/tracks/t/copy.mdx" }),
        lesson("b", { prerequisites: ["a", "missing"], glossaryTerms: ["nope"] }),
        lesson("c", { prerequisites: ["c"], termRefs: ["ghost", "ghost"] }),
        lesson("orphan", { locale: "en", file: "content/en/tracks/t/orphan.mdx" }),
      ],
      [term("ev", { lesson: "zzz" }), term("ev", { file: "content/glossary/ev2.yaml" })],
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'content/pl/tracks/t/copy.mdx: id: "a" is already used by content/pl/tracks/t/a.mdx',
        'content/pl/tracks/t/b.mdx: prerequisites[1]: unknown lesson id "missing"',
        'content/pl/tracks/t/b.mdx: glossaryTerms[0]: unknown glossary term "nope"',
        "content/pl/tracks/t/c.mdx: prerequisites[0]: a lesson can't require itself",
        'content/pl/tracks/t/c.mdx: <Term id="ghost">: unknown glossary term',
        expect.stringMatching(/^content\/en\/tracks\/t\/orphan\.mdx: id: translation of "orphan"/),
        'content/glossary/ev.yaml: lesson: unknown lesson id "zzz"',
        'content/glossary/ev2.yaml: id: duplicate glossary id "ev"',
      ]),
    );
    expect(errors.filter((e) => e.includes("ghost"))).toHaveLength(1);
  });

  it("finds prerequisite cycles", () => {
    const errors = validateContent(
      [
        lesson("a", { prerequisites: ["c"] }),
        lesson("b", { prerequisites: ["a"] }),
        lesson("c", { prerequisites: ["b"] }),
      ],
      [],
    );
    expect(errors).toEqual([expect.stringMatching(/prerequisites: cycle a → c → b → a$/)]);
  });
});

describe("termRefsIn", () => {
  it("finds <Term> ids with either quote style and other attributes", () => {
    expect(termRefsIn(`<Term id="ev">x</Term> and <Term plural id='var'>y</Term>`)).toEqual([
      "ev",
      "var",
    ]);
  });
});

describe("validateCurriculum", () => {
  const outline = (lessons: string[][]) => [
    {
      id: "t",
      slug: { pl: "t-pl", en: "t-en" },
      name: { pl: "T", en: "T" },
      description: { pl: "Opis", en: "Description" },
      modules: lessons.map((ids, i) => ({
        id: `m${String(i)}`,
        slug: { pl: `m${String(i)}`, en: `m${String(i)}` },
        name: { pl: "M", en: "M" },
        lessons: ids,
      })),
    },
  ];
  const at = (id: string, mod = "m0", extra: Partial<LessonRef> = {}) =>
    lesson(id, { file: `content/pl/tracks/t/${mod}/${id}.mdx`, ...extra });

  it("accepts lessons listed once, in their folders, with earlier prerequisites", () => {
    const lessons = [
      at("a"),
      at("b", "m1", { prerequisites: ["a"] }),
      lesson("s", { sample: true }),
    ];
    expect(validateCurriculum(outline([["a"], ["b"]]), lessons)).toEqual([]);
  });

  it("reports every way the outline and the files can disagree", () => {
    const lessons = [
      at("a", "m0", { prerequisites: ["b"] }),
      at("b"),
      lesson("unlisted", { file: "content/pl/tracks/t/m0/unlisted.mdx" }),
      lesson("c", { file: "content/pl/tracks/elsewhere/c.mdx" }),
    ];
    const errors = validateCurriculum(outline([["a", "b", "c", "ghost"], ["a"]]), lessons);
    expect(errors).toEqual(
      expect.arrayContaining([
        'content/curriculum.ts: tracks[0].modules[0].lessons[3]: no Polish lesson file for "ghost"',
        'content/curriculum.ts: tracks[0].modules[1].lessons[0]: "a" is already listed in t/m0',
        'content/pl/tracks/t/m0/unlisted.mdx: id: "unlisted" is not listed in content/curriculum.ts',
        "content/pl/tracks/elsewhere/c.mdx: file: belongs in content/pl/tracks/t/m0/",
        expect.stringMatching(
          /^content\/pl\/tracks\/t\/m0\/a\.mdx: prerequisites\[0\]: "b" comes later/,
        ),
      ]),
    );
  });

  it("reports duplicate slugs and schema problems with their path", () => {
    const dup = outline([["a"], ["b"]]);
    const second = dup[0]?.modules[1];
    if (second) second.slug.pl = "m0";
    expect(validateCurriculum(dup, [at("a"), at("b", "m1")])).toContain(
      'content/curriculum.ts: module slug in "t" (pl): "m0" is used twice',
    );
    expect(validateCurriculum([{ id: "Bad Id" }], [])[0]).toMatch(
      /^content\/curriculum\.ts: 0\.id: /,
    );
  });
});
