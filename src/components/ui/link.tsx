import NextLink from "next/link";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

export type LinkProps = ComponentProps<typeof NextLink> & { quiet?: boolean };

/** In-text link. `quiet` drops the accent colour for navigation-like links. */
export function Link({ className, quiet = false, ...props }: LinkProps) {
  return (
    <NextLink
      className={cx(
        "underline decoration-1 underline-offset-[0.2em] transition-colors",
        quiet
          ? "text-ink decoration-rule-strong hover:decoration-ink"
          : "text-accent-text decoration-accent-text/40 hover:decoration-accent-text",
        className,
      )}
      {...props}
    />
  );
}
