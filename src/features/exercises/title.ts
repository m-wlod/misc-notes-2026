/** A short plain-text title from an exercise prompt (math markers and markdown dropped). */
export function plainTitle(text: string, max = 90): string {
  const s = text
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 2)}…` : s;
}
