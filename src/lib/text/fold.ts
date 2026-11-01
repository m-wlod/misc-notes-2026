/**
 * Lowercase, diacritics removed: "Rozkład" → "rozklad", "Łańcuch" → "lancuch".
 * ł/Ł don't decompose in Unicode, so they are mapped by hand. Used by search and the
 * glossary filter so Polish learners can type without Polish letters.
 */
export function fold(text: string): string {
  return text.normalize("NFD").replaceAll(/\p{M}/gu, "").replaceAll(/[łŁ]/g, "l").toLowerCase();
}

/** Folded word tokens (letters and digits). */
export function words(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}
