import { describe, expect, it } from "vitest";

import { rehypeNumbering, type HNode } from "./rehype-numbering";

const math = (tex: string): HNode => ({
  type: "element",
  tagName: "pre",
  children: [
    {
      type: "element",
      tagName: "code",
      properties: { className: ["language-math", "math-display"] },
      children: [{ type: "text", value: tex }],
    },
  ],
});
const jsx = (name: string, attributes: Record<string, string> = {}): HNode => ({
  type: "mdxJsxFlowElement",
  name,
  attributes: Object.entries(attributes).map(([n, value]) => ({
    type: "mdxJsxAttribute" as const,
    name: n,
    value,
  })),
  children: [],
});
const attrOf = (node: HNode | undefined, name: string) =>
  node?.attributes?.find((a) => a.name === name)?.value;
const run = (children: HNode[]) => {
  const tree: HNode = { type: "root", children };
  rehypeNumbering()(tree, { path: "content/pl/x.mdx" });
  return tree.children ?? [];
};

describe("rehypeNumbering", () => {
  it("numbers display equations in order and strips \\label from the TeX", () => {
    const [a, b] = run([math("a = b \\label{first}"), math("c = d")]);
    expect(a?.name).toBe("Equation");
    expect(attrOf(a, "number")).toBe("1");
    expect(attrOf(b, "number")).toBe("2");
    expect(a?.children?.[0]?.children?.[0]?.children?.[0]?.value).toBe("a = b");
  });

  it("resolves <EqRef> to the labelled equation, wherever it appears", () => {
    const ref = jsx("EqRef", { to: "second" });
    run([ref, math("x"), math("y \\label{second}")]);
    expect(attrOf(ref, "number")).toBe("2");
  });

  it("numbers figures and sidenotes separately, including nested ones", () => {
    const nested = jsx("Sidenote");
    const wrapper: HNode = { type: "element", tagName: "p", children: [jsx("Sidenote"), nested] };
    const [fig1, , fig2] = run([jsx("Figure"), wrapper, jsx("Figure")]);
    expect(attrOf(fig1, "number")).toBe("1");
    expect(attrOf(fig2, "number")).toBe("2");
    expect(attrOf(nested, "n")).toBe("2");
  });

  it("fails with the file name on an unknown or duplicate label", () => {
    expect(() => run([jsx("EqRef", { to: "nope" }), math("x")])).toThrow(
      /content\/pl\/x\.mdx: <EqRef to="nope" \/>: no equation is labelled "nope"/,
    );
    expect(() => run([math("a \\label{d}"), math("b \\label{d}")])).toThrow(
      /equation label "d" is used twice/,
    );
  });
});
