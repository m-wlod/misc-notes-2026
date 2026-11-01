import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge taught our theme: the custom type scale (`text-2xs`, `text-reading`)
 * is a font size, not a colour, so `cx("text-reading", "text-ink")` keeps both.
 */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs", "reading"],
      radius: ["sm", "md"],
    },
  },
});

/** Joins class names, skipping falsy values; a later utility overrides an earlier conflicting one. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return merge(classes.filter(Boolean).join(" "));
}
