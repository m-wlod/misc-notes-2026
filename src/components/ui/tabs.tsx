"use client";

import { Tabs as RadixTabs } from "radix-ui";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

export const Tabs = RadixTabs.Root;

type ListProps = ComponentProps<typeof RadixTabs.List> & {
  /** `underline` for page sections, `segmented` for compact toggles (e.g. Po ludzku / Podręcznik). */
  variant?: "underline" | "segmented";
};

export function TabsList({ variant = "underline", className, ...props }: ListProps) {
  return (
    <RadixTabs.List
      data-variant={variant}
      className={cx(
        "group/tabs inline-flex",
        variant === "underline"
          ? "gap-6 border-b border-rule"
          : "rounded border border-rule-strong",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cx(
        "text-sm text-ink-muted transition-[color,background-color,border-color] hover:text-ink",
        // underline variant
        "group-data-[variant=underline]/tabs:-mb-px group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:border-transparent group-data-[variant=underline]/tabs:py-2",
        "group-data-[variant=underline]/tabs:data-[state=active]:border-accent group-data-[variant=underline]/tabs:data-[state=active]:text-ink",
        // segmented variant
        "group-data-[variant=segmented]/tabs:px-3 group-data-[variant=segmented]/tabs:py-1.5",
        "group-data-[variant=segmented]/tabs:data-[state=active]:bg-ink group-data-[variant=segmented]/tabs:data-[state=active]:text-bg",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cx("pt-4", className)} {...props} />;
}
