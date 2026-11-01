/**
 * Odds of producing a given URL path by pressing keys uniformly at random, for the
 * 404 page. Characters: a–z, 0–9, "-" and "/" (38). Each keystroke is independent,
 * so the odds are 1 in 38^n, reported as mantissa · 10^exponent.
 */
export const TYPING_ALPHABET = 38;

export type TypingOdds = { length: number; mantissa: number; exponent: number };

export function randomTypingOdds(path: string, alphabet = TYPING_ALPHABET): TypingOdds {
  const length = path.replace(/^\/+/, "").length;
  const log10 = length * Math.log10(alphabet);
  let exponent = Math.floor(log10);
  let mantissa = Number((10 ** (log10 - exponent)).toFixed(1));
  if (mantissa >= 10) {
    mantissa = 1;
    exponent += 1;
  }
  return { length, mantissa, exponent };
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** "4,8·10²⁵" (pl) / "4.8·10²⁵" (en); small values are written out ("1444"). */
export function formatOdds({ mantissa, exponent }: TypingOdds, locale: "pl" | "en"): string {
  const tag = locale === "pl" ? "pl-PL" : "en-GB";
  if (exponent < 6) {
    return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(
      Math.round(mantissa * 10 ** exponent),
    );
  }
  const m = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(mantissa);
  const e = String(exponent)
    .split("")
    .map((d) => SUPERSCRIPT[Number(d)])
    .join("");
  return `${m}·10${e}`;
}
