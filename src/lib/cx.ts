/** Joins class names, skipping falsy values. Deliberately tiny: no merge magic. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
