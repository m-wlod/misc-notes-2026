/**
 * Parses a number typed by a learner, Polish or English style.
 *
 * Accepts: `0,25`, `0.25`, `-1,5`, `−1,5` (Unicode minus), `1 240` (space or NBSP as
 * thousands separator), `12,5%`, `3/8`, `-3/8`, `1e-3`, `1,5e-3`, `2,5 · 10^-3`.
 * Rejects ambiguous input (both `.` and `,` present, e.g. `1.234,5`) instead of guessing.
 *
 * Pure and shared: NumberInput uses it for instant formatting, and the Phase 9 server
 * grader uses it to normalise submitted answers.
 */

export type ParsedNumberKind = "decimal" | "percent" | "fraction" | "scientific";

export type ParseNumberResult =
  | { ok: true; value: number; kind: ParsedNumberKind }
  | { ok: false; reason: "empty" | "ambiguous" | "invalid" | "division-by-zero" };

const DECIMAL = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
const SCIENTIFIC = /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))e([+-]?\d+)$/i;
const TIMES_TEN = /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))[·*x×]10\^?([+-]?\d+)$/i;

function toNumber(decimal: string): number {
  return Number(decimal.replace(",", "."));
}

export function parseLocaleNumber(raw: string): ParseNumberResult {
  const input = raw
    .trim()
    .replace(/[−–]/g, "-") // Unicode minus and en dash typed as minus
    .replace(/[\s  ]+/g, ""); // spaces, NBSP, narrow NBSP (thousands separators)

  if (input === "") return { ok: false, reason: "empty" };
  if (input.includes(",") && input.includes(".")) return { ok: false, reason: "ambiguous" };

  if (input.endsWith("%")) {
    const body = input.slice(0, -1);
    if (!DECIMAL.test(body)) return { ok: false, reason: "invalid" };
    return { ok: true, value: toNumber(body) / 100, kind: "percent" };
  }

  if (input.includes("/")) {
    const parts = input.split("/");
    const [num, den] = parts;
    if (parts.length !== 2 || num === undefined || den === undefined) {
      return { ok: false, reason: "invalid" };
    }
    if (!DECIMAL.test(num) || !/^\d+(?:[.,]\d+)?$/.test(den)) {
      return { ok: false, reason: "invalid" };
    }
    const d = toNumber(den);
    if (d === 0) return { ok: false, reason: "division-by-zero" };
    return { ok: true, value: toNumber(num) / d, kind: "fraction" };
  }

  const sci = SCIENTIFIC.exec(input) ?? TIMES_TEN.exec(input);
  if (sci) {
    const [, mantissa = "", exponent = ""] = sci;
    const value = toNumber(mantissa) * 10 ** Number(exponent);
    return Number.isFinite(value)
      ? { ok: true, value, kind: "scientific" }
      : { ok: false, reason: "invalid" };
  }

  if (!DECIMAL.test(input)) return { ok: false, reason: "invalid" };
  return { ok: true, value: toNumber(input), kind: "decimal" };
}
