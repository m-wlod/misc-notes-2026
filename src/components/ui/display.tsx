import { Progress as RadixProgress } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cx } from "@/lib/cx";

/* ---------- Badge ---------- */

/** No accent tone: orange is for actions and focus only (DESIGN.md principle 2). */
type BadgeTone = "neutral" | "correct" | "wrong";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-rule-strong text-ink-muted",
  correct: "border-correct text-correct",
  wrong: "border-wrong text-wrong",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-xs font-medium tracking-wide",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Progress ---------- */

export function clampProgress(value: number, max: number): number {
  if (!Number.isFinite(value) || !(max > 0)) return 0;
  return Math.min(max, Math.max(0, value));
}

export function Progress({
  value,
  max = 100,
  className,
  ...props
}: Omit<ComponentProps<typeof RadixProgress.Root>, "value" | "max"> & {
  value: number;
  max?: number;
}) {
  // Radix treats value > max as invalid and drops aria-valuenow, so clamp before passing it on.
  const safeMax = max > 0 ? max : 100;
  const v = clampProgress(value, safeMax);
  const pct = (v / safeMax) * 100;
  return (
    <RadixProgress.Root
      value={v}
      max={safeMax}
      className={cx("relative h-0.5 w-full overflow-hidden bg-rule", className)}
      {...props}
    >
      <RadixProgress.Indicator
        className="h-full bg-accent transition-transform duration-(--duration)"
        style={{ transform: `translateX(-${String(100 - pct)}%)` }}
      />
    </RadixProgress.Root>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cx("rounded-sm bg-sunken motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

/* ---------- Kbd ---------- */

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cx(
        "inline-block rounded-sm border border-b-2 border-rule-strong px-1.5 num text-xs leading-5 text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Table ---------- */

type TableProps = ComponentProps<"table"> & {
  caption?: ReactNode;
  /** Accessible name of the horizontal scroll region (usually the caption text). */
  label: string;
};

export function Table({ className, caption, label, children, ...props }: TableProps) {
  return (
    // Focusable scroll region so keyboard users can scroll wide tables (WCAG 2.1.1).
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto">
      <table className={cx("w-full border-collapse text-sm", className)} {...props}>
        {caption ? (
          <caption className="mb-2 text-left text-xs text-ink-muted">{caption}</caption>
        ) : null}
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  numeric = false,
  ...props
}: ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-rule-strong px-3 py-2 text-xs font-medium tracking-wide text-ink-muted uppercase",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric = false,
  ...props
}: ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cx(
        "border-b border-rule px-3 py-2",
        numeric ? "text-right num" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Callout ---------- */

type CalloutTone = "note" | "correct" | "wrong";
const calloutTones: Record<CalloutTone, string> = {
  note: "border-rule-strong",
  correct: "border-correct",
  wrong: "border-wrong",
};

/**
 * A left-ruled note inside running text (`role="note"`, not an <aside> landmark).
 * `label` is a small uppercase heading (e.g. "Uwaga", "Mit").
 */
export function Callout({
  tone = "note",
  label,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { tone?: CalloutTone; label?: ReactNode }) {
  return (
    <div
      role="note"
      className={cx("border-l-2 py-1 pl-5", calloutTones[tone], className)}
      {...props}
    >
      {label ? (
        <p className="mb-1.5 font-sans text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}
