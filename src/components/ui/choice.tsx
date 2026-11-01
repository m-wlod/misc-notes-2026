"use client";

import { Checkbox as RadixCheckbox, RadioGroup as RadixRadio } from "radix-ui";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

import { CheckIcon } from "./icons";

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
        <CheckIcon />
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

/**
 * ARIA radio groups select on arrow keys. Radix detects arrows with a document listener
 * that runs after React's (Next mounts React on the document), so focus moved without
 * selecting. Use as `onFocus` on a RadioGroup item: keyboard focus selects, mouse clicks
 * are unaffected. Found in Phase 4b; also fixes the theme switch.
 */
export function selectOnKeyboardFocus(select: () => void) {
  return (e: React.FocusEvent<HTMLElement>) => {
    if (e.currentTarget.matches(":focus-visible")) select();
  };
}
