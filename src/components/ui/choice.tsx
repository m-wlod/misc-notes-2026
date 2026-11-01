"use client";

import { Checkbox as RadixCheckbox, RadioGroup as RadixRadio } from "radix-ui";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

const box =
  "flex size-[18px] shrink-0 items-center justify-center border border-rule-strong bg-surface";

export function Checkbox({ className, ...props }: ComponentProps<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={cx(
        box,
        "rounded-sm data-[state=checked]:border-ink data-[state=checked]:bg-ink",
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator className="text-bg">
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadixRadio.Root>) {
  return <RadixRadio.Root className={cx("grid gap-2", className)} {...props} />;
}

export function RadioItem({ className, ...props }: ComponentProps<typeof RadixRadio.Item>) {
  return (
    <RadixRadio.Item
      className={cx(box, "rounded-full data-[state=checked]:border-ink", className)}
      {...props}
    >
      <RadixRadio.Indicator className="size-2 rounded-full bg-ink" />
    </RadixRadio.Item>
  );
}
