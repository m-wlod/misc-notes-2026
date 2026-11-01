import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-95 active:brightness-90",
  secondary: "border border-rule-strong text-ink hover:bg-sunken",
  ghost: "text-ink-muted hover:text-ink hover:bg-sunken",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
};

export type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  /** Render the child element (e.g. a link) with button styling. */
  asChild?: boolean;
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded font-medium whitespace-nowrap select-none",
    "transition-[background-color,filter,color] duration-(--duration-fast)",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={buttonClass(variant, size, className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
