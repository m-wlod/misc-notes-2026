/**
 * A small math-expression language for symbolic answers: parse once, then evaluate (server
 * grading compares expressions numerically) or print as TeX (live preview in the input).
 *
 *   numbers   2, 0.5, 0,5 (Polish comma), 1e-3
 *   operators + − * / ^ (right-assoc), unary −, parentheses, implicit product: 2x, 3(x+1), x y
 *   names     variables (one letter or a word), pi, e
 *   functions sqrt exp ln log sin cos tan abs
 *
 * Shared by server and browser; no dependencies.
 */

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "neg"; arg: Expr }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr }
  | { kind: "call"; fn: Fn; arg: Expr };

const FUNCTIONS = ["sqrt", "exp", "ln", "log", "sin", "cos", "tan", "abs"] as const;
type Fn = (typeof FUNCTIONS)[number];
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export class ExprError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message);
    this.name = "ExprError";
  }
}

type Token =
  | { t: "num"; v: number; at: number }
  | { t: "name"; v: string; at: number }
  | { t: "op"; v: string; at: number };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] ?? "";
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9]/.test(c) || ((c === "." || c === ",") && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i));
      const text = m?.[0] ?? c;
      tokens.push({ t: "num", v: Number(text.replace(",", ".")), at: i });
      i += text.length;
    } else if (/[a-zA-Z]/.test(c)) {
      const m = /^[a-zA-Z]+/.exec(src.slice(i));
      const word = m?.[0] ?? c;
      tokens.push({ t: "name", v: word, at: i });
      i += word.length;
    } else if ("+-−*·/^()".includes(c)) {
      tokens.push({ t: "op", v: c === "−" ? "-" : c === "·" ? "*" : c, at: i });
      i++;
    } else {
      throw new ExprError(`unexpected "${c}"`, i);
    }
  }
  return tokens;
}

/** Parse an expression; throws ExprError with a position on bad input. */
export function parseExpr(src: string): Expr {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const at = () => peek()?.at ?? src.length;

  // Words that are not functions or constants are split into single-letter variables
  // ("xy" = x·y), except known names.
  function nameExpr(word: string, start: number): Expr {
    if (word in CONSTANTS) return { kind: "var", name: word };
    if (word.length === 1) return { kind: "var", name: word };
    let e: Expr | null = null;
    for (let k = 0; k < word.length; k++) {
      const v: Expr = { kind: "var", name: word[k] ?? "" };
      e = e ? { kind: "bin", op: "*", left: e, right: v } : v;
    }
    if (!e) throw new ExprError("empty name", start);
    return e;
  }

  function primary(): Expr {
    const tok = peek();
    if (!tok) throw new ExprError("expression ends too early", src.length);
    if (tok.t === "num") {
      pos++;
      return { kind: "num", value: tok.v };
    }
    if (tok.t === "name") {
      pos++;
      if ((FUNCTIONS as readonly string[]).includes(tok.v)) {
        const next = peek();
        if (!(next?.t === "op" && next.v === "(")) {
          throw new ExprError(`${tok.v} needs parentheses, e.g. ${tok.v}(x)`, at());
        }
        pos++;
        const arg = sum();
        expect(")");
        return { kind: "call", fn: tok.v as Fn, arg };
      }
      return nameExpr(tok.v, tok.at);
    }
    if (tok.v === "(") {
      pos++;
      const inner = sum();
      expect(")");
      return inner;
    }
    throw new ExprError(`unexpected "${tok.v}"`, tok.at);
  }

  function expect(op: string) {
    const tok = peek();
    if (!(tok?.t === "op" && tok.v === op)) throw new ExprError(`missing "${op}"`, at());
    pos++;
  }

  // power: primary (^ unary)?   right-associative
  function power(): Expr {
    const base = primary();
    const tok = peek();
    if (tok?.t === "op" && tok.v === "^") {
      pos++;
      return { kind: "bin", op: "^", left: base, right: unary() };
    }
    return base;
  }

  function unary(): Expr {
    const tok = peek();
    if (tok?.t === "op" && (tok.v === "-" || tok.v === "+")) {
      pos++;
      const arg = unary();
      return tok.v === "-" ? { kind: "neg", arg } : arg;
    }
    return power();
  }

  // product: unary ((* | / | implicit) unary)*
  function product(): Expr {
    let left = unary();
    for (;;) {
      const tok = peek();
      if (tok?.t === "op" && (tok.v === "*" || tok.v === "/")) {
        pos++;
        left = { kind: "bin", op: tok.v, left, right: unary() };
      } else if (tok && (tok.t !== "op" || tok.v === "(")) {
        // implicit multiplication: 2x, 3(x+1), x y, 2 sqrt(x)
        left = { kind: "bin", op: "*", left, right: power() };
      } else {
        return left;
      }
    }
  }

  function sum(): Expr {
    let left = product();
    for (;;) {
      const tok = peek();
      if (tok?.t === "op" && (tok.v === "+" || tok.v === "-")) {
        pos++;
        left = { kind: "bin", op: tok.v, left, right: product() };
      } else {
        return left;
      }
    }
  }

  if (tokens.length === 0) throw new ExprError("empty expression", 0);
  const tree = sum();
  if (pos < tokens.length) throw new ExprError(`unexpected "${String(peek()?.v)}"`, at());
  return tree;
}

export function evaluate(e: Expr, vars: Readonly<Record<string, number>>): number {
  switch (e.kind) {
    case "num":
      return e.value;
    case "var": {
      const v = vars[e.name] ?? CONSTANTS[e.name];
      if (v === undefined) throw new ExprError(`unknown variable "${e.name}"`, 0);
      return v;
    }
    case "neg":
      return -evaluate(e.arg, vars);
    case "bin": {
      const a = evaluate(e.left, vars);
      const b = evaluate(e.right, vars);
      switch (e.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return a / b;
        case "^":
          return a ** b;
      }
    }
    case "call": {
      const x = evaluate(e.arg, vars);
      const fns: Record<Fn, (v: number) => number> = {
        sqrt: Math.sqrt,
        exp: Math.exp,
        ln: Math.log,
        log: Math.log10,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        abs: Math.abs,
      };
      return fns[e.fn](x);
    }
  }
}

/** Variables used (constants excluded), sorted. */
export function variables(e: Expr): string[] {
  const out = new Set<string>();
  const walk = (n: Expr) => {
    if (n.kind === "var" && !(n.name in CONSTANTS)) out.add(n.name);
    if (n.kind === "neg" || n.kind === "call") walk(n.arg);
    if (n.kind === "bin") {
      walk(n.left);
      walk(n.right);
    }
  };
  walk(e);
  return [...out].sort();
}

const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 } as const;

/** TeX for the live preview. Decimals print with a comma when `comma` is set (Polish). */
export function toTex(e: Expr, comma = false): string {
  const num = (v: number) => {
    const s = String(v);
    return comma ? s.replace(".", "{,}") : s;
  };
  const wrap = (n: Expr, minPrec: number): string => {
    const tex = toTex(n, comma);
    const p = n.kind === "bin" ? PREC[n.op] : n.kind === "neg" ? 1.5 : 4;
    return p < minPrec ? `\\left(${tex}\\right)` : tex;
  };
  switch (e.kind) {
    case "num":
      return num(e.value);
    case "var":
      return e.name === "pi" ? "\\pi" : e.name;
    case "neg":
      return `-${wrap(e.arg, 2)}`;
    case "call": {
      const arg = toTex(e.arg, comma);
      if (e.fn === "sqrt") return `\\sqrt{${arg}}`;
      if (e.fn === "abs") return `\\left|${arg}\\right|`;
      if (e.fn === "exp") return `e^{${arg}}`;
      return `\\${e.fn}\\left(${arg}\\right)`;
    }
    case "bin":
      if (e.op === "/") return `\\frac{${toTex(e.left, comma)}}{${toTex(e.right, comma)}}`;
      if (e.op === "^") return `{${wrap(e.left, 4)}}^{${toTex(e.right, comma)}}`;
      if (e.op === "*") {
        const l = wrap(e.left, 2);
        const r = wrap(e.right, 2);
        // A number followed by a number needs a visible dot; otherwise juxtapose.
        const dot = e.right.kind === "num" || (e.left.kind !== "num" && e.right.kind !== "var");
        return dot ? `${l} \\cdot ${r}` : `${l}${r}`;
      }
      return `${wrap(e.left, 1)} ${e.op} ${wrap(e.right, e.op === "-" ? 2 : 1)}`;
  }
}

/** Seeded PRNG (mulberry32) so grading samples the same points every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Are two expressions the same function? Both are evaluated at `points` seeded random
 * points in [0.3, 2.3] (positive, so ln and sqrt are defined) with a relative tolerance.
 * `fixed` pins some names (exercise params) to values. Points where either side is
 * undefined (NaN, ±∞) are skipped; at least `minValid` must be compared.
 */
export function equivalent(
  a: Expr,
  b: Expr,
  {
    points = 12,
    minValid = 6,
    tol = 1e-7,
    fixed = {},
  }: {
    points?: number;
    minValid?: number;
    tol?: number;
    fixed?: Readonly<Record<string, number>>;
  } = {},
): boolean {
  const names = [...new Set([...variables(a), ...variables(b)])].filter((n) => !(n in fixed));
  const next = rng(20261102);
  let compared = 0;
  for (let i = 0; i < points * 3 && compared < points; i++) {
    const vars = { ...Object.fromEntries(names.map((n) => [n, 0.3 + 2 * next()])), ...fixed };
    let x: number;
    let y: number;
    try {
      x = evaluate(a, vars);
      y = evaluate(b, vars);
    } catch {
      return false; // an unknown name: not the same expression
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    compared++;
    if (Math.abs(x - y) > tol * Math.max(1, Math.abs(x), Math.abs(y))) return false;
  }
  return compared >= Math.min(minValid, points);
}
