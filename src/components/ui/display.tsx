import { Progress as RadixProgress } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cx } from "@/lib/cx";

/* ---------- Badge ---------- */

type BadgeTone = "neutral" | "accent" | "correct" | "wrong";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-rule-strong text-ink-muted",
  accent: "border-accent-text text-accent-text",
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

export function Progress({
  value,
  max = 100,
  className,
  ...props
}: Omit<ComponentProps<typeof RadixProgress.Root>, "value" | "max"> & {
  value: number;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <RadixProgress.Root
      value={value}
      max={max}
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

export function Table({
  className,
  caption,
  children,
  ...props
}: ComponentProps<"table"> & { caption?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
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

type CalloutTone = "note" | "accent" | "correct" | "wrong";
const calloutTones: Record<CalloutTone, string> = {
  note: "border-rule-strong",
  accent: "border-accent",
  correct: "border-correct",
  wrong: "border-wrong",
};

/** A left-ruled aside. `label` is a small uppercase heading (e.g. "Uwaga", "Mit"). */
export function Callout({
  tone = "note",
  label,
  className,
  children,
  ...props
}: ComponentProps<"aside"> & { tone?: CalloutTone; label?: ReactNode }) {
  return (
    <aside className={cx("border-l-2 py-1 pl-5", calloutTones[tone], className)} {...props}>
      {label ? (
        <p className="mb-1.5 text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
          {label}
        </p>
      ) : null}
      {children}
    </aside>
  );
}
