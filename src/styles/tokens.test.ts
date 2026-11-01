import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the real tokens.css and checks WCAG 2.1 contrast for every pair the UI uses,
 * in both themes. Text needs 4.5:1 (AA); control borders and focus rings need 3:1.
 */

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no block for ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)) {
    const [, name, hex] = m;
    if (name && hex) vars[name] = hex;
  }
  return vars;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(":root");
const dark = { ...light, ...block('[data-theme="dark"]') };

const TEXT = 4.5;
const UI = 3;
const pairs: [fg: string, bg: string, min: number][] = [
  ["ink", "bg", TEXT],
  ["ink", "surface", TEXT],
  ["ink", "sunken", TEXT],
  ["ink-muted", "bg", TEXT],
  ["ink-muted", "surface", TEXT],
  ["ink-muted", "sunken", TEXT],
  ["accent-text", "bg", TEXT],
  ["accent-text", "surface", TEXT],
  ["on-accent", "accent", TEXT],
  ["bg", "ink", TEXT], // inverted: selected segment, tooltip
  ["correct", "bg", TEXT],
  ["correct", "surface", TEXT],
  ["wrong", "bg", TEXT],
  ["wrong", "surface", TEXT],
  ["rule-strong", "surface", UI],
  ["rule-strong", "bg", UI],
  ["focus", "bg", UI],
  ["focus", "surface", UI],
  ["accent", "bg", UI],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_theme, tokens) => {
  it.each(pairs)("%s on %s ≥ %d:1", (fg, bg, min) => {
    const a = tokens[fg];
    const b = tokens[bg];
    expect(a, `missing --${fg}`).toBeDefined();
    expect(b, `missing --${bg}`).toBeDefined();
    expect(contrast(a ?? "", b ?? "")).toBeGreaterThanOrEqual(min);
  });
});
