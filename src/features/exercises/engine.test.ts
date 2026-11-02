import { describe, expect, it } from "vitest";

import { loadExercises } from "@/features/content/pipeline/load";

import { grade, variantCount, variantOf } from "./grade";
import { fillPlaceholders, renderText } from "./render-text";
import type { Exercise } from "./schema";
import { publicView } from "./view";

const samples = new Map(
  loadExercises("content").exercises.map(({ exercise }) => [exercise.id, exercise]),
);
const ex = (id: string): Exercise => {
  const e = samples.get(id);
  if (!e) throw new Error(`sample ${id} missing`);
  return e;
};
const text = (value: string) => ({ kind: "text" as const, value });

describe("grade", () => {
  it("numeric: locale input, per-variant answers", () => {
    const e = ex("przyklad-liczba");
    expect(grade(e, 0, text("5"))).toMatchObject({ ok: true, result: "correct" });
    expect(grade(e, 0, text("5,0"))).toMatchObject({ result: "correct" });
    expect(grade(e, 0, text("6"))).toMatchObject({ result: "wrong", score: 0 });
    expect(grade(e, 1, text("11"))).toMatchObject({ result: "correct" });
    expect(grade(e, 0, text("pięć"))).toEqual({ ok: false, reason: "unreadable" });
    expect(variantCount(e)).toBe(3);
    expect(variantOf(e, 2).params).toMatchObject({ a: 10, b: 15 });
  });

  it("estimation: partial credit by orders of magnitude", () => {
    const e = ex("przyklad-szacowanie");
    expect(grade(e, 0, text("86400"))).toMatchObject({ result: "correct", score: 1 });
    expect(grade(e, 0, text("100000"))).toMatchObject({ result: "partial", score: 0.94 });
    expect(grade(e, 0, text("1000"))).toMatchObject({ result: "wrong", score: 0 });
    expect(grade(e, 0, text("-86400"))).toMatchObject({ result: "wrong" });
  });

  it("interactive: slider value within tolerance", () => {
    const e = ex("przyklad-suwak");
    expect(grade(e, 0, { kind: "number", value: 5 })).toMatchObject({ result: "correct" });
    expect(grade(e, 0, { kind: "number", value: 5.5 })).toMatchObject({ result: "wrong" });
  });

  it("symbolic: equivalent forms are correct", () => {
    const e = ex("przyklad-wyrazenie");
    for (const v of ["(x+1)^2", "x^2 + 2x + 1", "(1 + x)(x + 1)"]) {
      expect(grade(e, 0, text(v))).toMatchObject({ result: "correct" });
    }
    expect(grade(e, 0, text("x^2 + 1"))).toMatchObject({ result: "wrong" });
    expect(grade(e, 0, text("x^^2"))).toEqual({ ok: false, reason: "unreadable" });
  });

  it("choice, multi (partial) and ordering (partial)", () => {
    expect(grade(ex("przyklad-wybor"), 0, { kind: "choice", value: "b" })).toMatchObject({
      result: "correct",
    });
    const multi = ex("przyklad-wielokrotny");
    expect(grade(multi, 0, { kind: "multi", values: ["a", "c"] })).toMatchObject({ score: 1 });
    expect(grade(multi, 0, { kind: "multi", values: ["a"] })).toMatchObject({
      result: "partial",
      score: 0.5,
    });
    expect(grade(multi, 0, { kind: "multi", values: ["a", "b"] })).toMatchObject({ score: 0 });
    const order = ex("przyklad-kolejnosc");
    expect(grade(order, 0, { kind: "order", values: ["b", "a", "c"] })).toMatchObject({
      score: 1,
    });
    expect(grade(order, 0, { kind: "order", values: ["a", "b", "c"] })).toMatchObject({
      result: "partial",
      score: 0.5,
    });
  });

  it("refuses the wrong kind of answer and ungradable types", () => {
    expect(grade(ex("przyklad-wybor"), 0, text("b"))).toEqual({ ok: false, reason: "wrong-kind" });
    expect(grade(ex("przyklad-kod"), 0, text("x"))).toEqual({ ok: false, reason: "not-gradable" });
  });
});

describe("publicView", () => {
  it.each([...samples.keys()])("%s reveals no answer, hint, solution or check", (id) => {
    const e = ex(id);
    const view = publicView(e, 0, "pl");
    const json = JSON.stringify(view);
    for (const key of ["answer", "hints", "solution", "rubric", "tests", "verify", "tolerance"]) {
      expect(view).not.toHaveProperty(key);
    }
    for (const h of e.hints) expect(json).not.toContain(h.pl);
    if (e.solution) expect(json).not.toContain(e.solution.pl);
    if ("tests" in e) expect(json).not.toContain(e.tests);
    if (e.verify) expect(json).not.toContain(e.verify.trim());
    expect(view.hintCount).toBe(e.hints.length);
  });

  it("never shows ordering options in the answer order", () => {
    const e = ex("przyklad-kolejnosc");
    const ids = publicView(e, 0, "pl").options.map((o) => o.id);
    expect(ids).not.toEqual(["b", "a", "c"]);
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  });

  it("fills the variant's params into the prompt", () => {
    const view = publicView(ex("przyklad-liczba"), 2, "pl");
    expect(view.promptHtml).toContain("10");
    expect(view.variant).toBe(2);
    expect(view.variants).toBe(3);
  });
});

describe("exercise text", () => {
  it("fills placeholders with locale numbers, TeX-safe inside math", () => {
    expect(fillPlaceholders("p = {p}, $q = {q}$, $\\frac{1}{2}$", { p: 0.5, q: 0.25 }, "pl")).toBe(
      "p = 0,5, $q = 0{,}25$, $\\frac{1}{2}$",
    );
    expect(fillPlaceholders("{p}", { p: 0.5 }, "en")).toBe("0.5");
  });

  it("escapes text and renders math with MathML", () => {
    const html = renderText("<b>x</b> & $x^2$");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt; &amp; ");
    expect(html).toContain("<math");
    expect(html).not.toContain("<b>");
  });
});
