/**
 * Parses a number typed by a learner, Polish or English style.
 *
 * Accepts: `0,25`, `0.25`, `-1,5`, `−1,5` (Unicode minus), `1 240` / `1 240,5` (space,
 * NBSP or narrow NBSP in valid groups of three), `12,5%`, `3/8`, `-3/8`, `1e-3`,
 * `1,5e-3`, `2,5 · 10^-3`.
 *
 * Never guesses. These are rejected as `ambiguous` instead:
 * - both `.` and `,` present (`1.234,5`, `1,234.5`);
 * - one separator followed by exactly three digits after a 1–3 digit integer part
 *   (`1,000`, `12.500`): a thousands separator in one convention, a decimal in the other.
 *   `0,125` is fine: a thousands group can't follow a leading zero.
 *
 * Pure and shared: NumberInput uses it for instant feedback, and the Phase 9 server
 * grader uses it to normalise submitted answers.
 */

export type ParsedNumberKind = "decimal" | "percent" | "fraction" | "scientific";

export type ParseNumberFailure = "empty" | "ambiguous" | "invalid" | "division-by-zero";

export type ParseNumberResult =
  { ok: true; value: number; kind: ParsedNumberKind } | { ok: false; reason: ParseNumberFailure };

type TokenResult = { ok: true; value: number } | { ok: false; reason: ParseNumberFailure };

const PLAIN = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
const GROUPED = /^[+-]?\d{1,3}(?: \d{3})+(?:[.,]\d+)?$/;
const THOUSANDS_LOOKALIKE = /^[+-]?[1-9]\d{0,2}[.,]\d{3}$/;
const SCIENTIFIC = /^(.+?)e([+-]?\d+)$/i;
const TIMES_TEN = /^(.+?)[·*×x]10\^([+-]?\d+)$/i;

/** One real number: plain, or grouped with spaces. */
function parseToken(token: string): TokenResult {
  if (GROUPED.test(token)) {
    return { ok: true, value: Number(token.replace(/ /g, "").replace(",", ".")) };
  }
  if (!PLAIN.test(token)) return { ok: false, reason: "invalid" };
  if (THOUSANDS_LOOKALIKE.test(token)) return { ok: false, reason: "ambiguous" };
  return { ok: true, value: Number(token.replace(",", ".")) };
}

export function parseLocaleNumber(raw: string): ParseNumberResult {
  const input = raw
    .replace(/[  \t]/g, " ") // NBSP, narrow NBSP, tab → space
    .replace(/[−–]/g, "-") // Unicode minus and en dash typed as minus
    .trim()
    .replace(/ +/g, " ")
    .replace(/ *([%/·*×^]) */g, "$1") // spaces around operators carry no meaning
    .replace(/ +([xX]) +/g, "$1");

  if (input === "") return { ok: false, reason: "empty" };
  if (input.includes(",") && input.includes(".")) return { ok: false, reason: "ambiguous" };

  if (input.endsWith("%")) {
    const t = parseToken(input.slice(0, -1));
    return t.ok ? { ok: true, value: t.value / 100, kind: "percent" } : t;
  }

  if (input.includes("/")) {
    const parts = input.split("/");
    const [num, den] = parts;
    if (parts.length !== 2 || num === undefined || den === undefined || /^[+-]/.test(den)) {
      return { ok: false, reason: "invalid" };
    }
    const n = parseToken(num);
    if (!n.ok) return n;
    const d = parseToken(den);
    if (!d.ok) return d;
    if (d.value === 0) return { ok: false, reason: "division-by-zero" };
    return { ok: true, value: n.value / d.value, kind: "fraction" };
  }

  const sci = TIMES_TEN.exec(input) ?? SCIENTIFIC.exec(input);
  if (sci) {
    const [, mantissa = "", exponent = ""] = sci;
    if (!PLAIN.test(mantissa)) return { ok: false, reason: "invalid" };
    const m = mantissa.replace(",", ".");
    // Build via the e-notation string so 3e-1 is exactly 0.3, not 3 × 10^-1.
    const value = Number(`${m}e${exponent}`);
    if (!Number.isFinite(value) || (value === 0 && Number(m) !== 0)) {
      return { ok: false, reason: "invalid" }; // overflow or underflow
    }
    return { ok: true, value, kind: "scientific" };
  }

  const t = parseToken(input);
  return t.ok ? { ok: true, value: t.value, kind: "decimal" } : t;
}
