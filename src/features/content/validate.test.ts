import { describe, expect, it } from "vitest";

import { termRefsIn, validateContent, type GlossaryRef, type LessonRef } from "./validate";

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
