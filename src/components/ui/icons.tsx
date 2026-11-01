import type { ComponentProps } from "react";

/* Functional icons only (check, close, chevron). Decorative icons are banned (docs/DESIGN.md). */

type IconProps = Omit<ComponentProps<"svg">, "viewBox" | "children">;

export function CheckIcon({ className = "size-3", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" {...props}>
      <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function CloseIcon({ className = "size-3", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" {...props}>
      <path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "size-3", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" {...props}>
      <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SearchIcon({ className = "size-4", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...props}>
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
