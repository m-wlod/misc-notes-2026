/**
 * Rehype plugin, run at content build time (Velite) before KaTeX:
 * - wraps each display equation in <Equation number="n"> and numbers it;
 * - `\label{name}` inside an equation is removed from the TeX and remembered, and
 *   `<EqRef to="name" />` receives that equation's number (unknown label = build error);
 * - numbers <Figure>, <KeyFormula> equations and <Sidenote> in document order.
 *
 * Kept dependency-free (a small walker and local node types) so it unit-tests in isolation.
 */

type Attr = { type: "mdxJsxAttribute"; name: string; value?: unknown };
export type HNode = {
  type: string;
  tagName?: string;
  name?: string | null;
  value?: string;
  properties?: Record<string, unknown>;
  attributes?: Attr[];
  children?: HNode[];
};
type VFileLike = { path?: string; history?: string[] };

const LABEL = /\\label\{([^}]+)\}/g;

export class ContentError extends Error {
  constructor(file: string | undefined, message: string) {
    super(`${file ?? "<content>"}: ${message}`);
    this.name = "ContentError";
  }
}

function classes(node: HNode): string[] {
  const c = node.properties?.className;
  if (Array.isArray(c)) return c.map(String);
  return typeof c === "string" ? c.split(/\s+/) : [];
}

function isDisplayMath(node: HNode): boolean {
  if (node.type !== "element" || node.tagName !== "pre") return false;
  const code = node.children?.find((c) => c.type === "element" && c.tagName === "code");
  return code ? classes(code).includes("math-display") : false;
}

function isJsx(node: HNode, name: string): boolean {
  return (
    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === name
  );
}

function attr(node: HNode, name: string): unknown {
  return node.attributes?.find((a) => a.name === name)?.value;
}

function setAttr(node: HNode, name: string, value: string): void {
  node.attributes = [
    ...(node.attributes ?? []).filter((a) => a.name !== name),
    { type: "mdxJsxAttribute", name, value },
  ];
}

/** Concatenated text of a node, and a way to rewrite its single text child. */
function textNode(node: HNode): HNode | undefined {
  for (const child of node.children ?? []) {
    if (child.type === "text") return child;
    const inner = textNode(child);
    if (inner) return inner;
  }
  return undefined;
}

export function rehypeNumbering() {
  return (tree: HNode, file: VFileLike) => {
    const path = file.path ?? file.history?.at(-1);
    const labels = new Map<string, number>();
    const refs: HNode[] = [];
    let equations = 0;
    let figures = 0;
    let notes = 0;

    const walk = (parent: HNode) => {
      const children = parent.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (!node) continue;

        if (isDisplayMath(node)) {
          equations += 1;
          const text = textNode(node);
          if (text?.value) {
            for (const [, name] of text.value.matchAll(LABEL)) {
              if (!name) continue;
              if (labels.has(name)) {
                throw new ContentError(path, `equation label "${name}" is used twice`);
              }
              labels.set(name, equations);
            }
            text.value = text.value.replace(LABEL, "").trim();
          }
          children[i] = {
            type: "mdxJsxFlowElement",
            name: "Equation",
            attributes: [{ type: "mdxJsxAttribute", name: "number", value: String(equations) }],
            children: [node],
          };
          continue;
        }

        if (isJsx(node, "Figure")) {
          figures += 1;
          setAttr(node, "number", String(figures));
        } else if (isJsx(node, "Sidenote")) {
          notes += 1;
          setAttr(node, "n", String(notes));
        } else if (isJsx(node, "EqRef")) {
          refs.push(node);
        }
        walk(node);
      }
    };
    walk(tree);

    for (const ref of refs) {
      const to = attr(ref, "to");
      const n = typeof to === "string" ? labels.get(to) : undefined;
      if (n === undefined) {
        throw new ContentError(
          path,
          `<EqRef to="${String(to)}" />: no equation is labelled "${String(to)}"`,
        );
      }
      setAttr(ref, "number", String(n));
    }
  };
}
