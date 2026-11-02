import katex from "katex";

/**
 * Exercise text (prompt, hints, solution): plain text with `$…$` / `$$…$$` math and
 * `{name}` placeholders for params. Rendered on the server to safe HTML: everything
 * outside math is escaped; math goes through KaTeX (MathML + HTML, like lessons).
 */

type Params = Readonly<Record<string, number | string | boolean>>;

const escapeHtml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Text segments: math (display or inline) or plain. */
function segments(text: string): { math: boolean; display: boolean; text: string }[] {
  const out: { math: boolean; display: boolean; text: string }[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ math: false, display: false, text: text.slice(last, m.index) });
    out.push({ math: true, display: m[1] !== undefined, text: m[1] ?? m[2] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ math: false, display: false, text: text.slice(last) });
  return out;
}

/** `{name}` → the param, locale-formatted. Inside math, decimals use a TeX-safe comma. */
export function fillPlaceholders(text: string, params: Params, locale: string): string {
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 10, useGrouping: false });
  return segments(text)
    .map((seg) => {
      const filled = seg.text.replaceAll(/\{([a-zA-Z_]\w*)\}/g, (whole, name: string) => {
        if (!(name in params)) return whole; // TeX groups like \frac{a}{b} stay as they are
        const v = params[name];
        if (typeof v !== "number") return String(v);
        const s = fmt.format(v);
        return seg.math ? s.replace(",", "{,}") : s;
      });
      if (!seg.math) return filled;
      return seg.display ? `$$${filled}$$` : `$${filled}$`;
    })
    .join("");
}

export function renderText(text: string): string {
  return segments(text)
    .map((seg) =>
      seg.math
        ? katex.renderToString(seg.text, {
            displayMode: seg.display,
            output: "htmlAndMathml",
            throwOnError: false,
          })
        : escapeHtml(seg.text).replaceAll("\n", "<br>"),
    )
    .join("");
}

/** Fill placeholders, then render: what every exercise text goes through. */
export function exerciseHtml(text: string, params: Params, locale: string): string {
  return renderText(fillPlaceholders(text, params, locale));
}
