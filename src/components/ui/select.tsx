"use client";

import { Select as RadixSelect } from "radix-ui";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

import { fieldClass } from "./field";
import { CheckIcon, ChevronDownIcon } from "./icons";

export type SelectOption = { value: string; label: string };

export type SelectProps = ComponentProps<typeof RadixSelect.Root> & {
  options: readonly SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

export function Select({
  options,
  placeholder,
  id,
  className,
  "aria-label": ariaLabel,
  ...props
}: SelectProps) {
  return (
    <RadixSelect.Root {...props}>
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cx(
          fieldClass,
          "flex h-10 items-center justify-between gap-2 text-left text-base",
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="text-ink-muted">
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-(--z-dropdown) max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded border border-rule-strong bg-surface"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={o.value}
                className="flex cursor-default items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-base text-ink outline-none select-none data-highlighted:bg-sunken data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-focus data-highlighted:outline-solid"
              >
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="text-accent-text">
                  <CheckIcon />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
