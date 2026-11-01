"use client";

import { Dialog as RadixDialog, Popover as RadixPopover, Tooltip as RadixTooltip } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cx } from "@/lib/cx";

import { CloseIcon } from "./icons";

/* Overlays are separated by a 1px rule, never a shadow. */
const panel = "rounded border border-rule-strong bg-surface text-ink";

/* ---------- Dialog ---------- */

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

type DialogContentProps = ComponentProps<typeof RadixDialog.Content> & {
  title: ReactNode;
  description?: ReactNode;
  /** Accessible label for the close button (localised by the caller). */
  closeLabel: string;
};

export function DialogContent({
  title,
  description,
  closeLabel,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-ink/40" />
      <RadixDialog.Content
        className={cx(
          panel,
          "fixed top-1/2 left-1/2 z-(--z-modal) max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <RadixDialog.Title className="font-serif text-xl">{title}</RadixDialog.Title>
          <RadixDialog.Close
            aria-label={closeLabel}
            className="-m-1 rounded-sm p-1 text-ink-muted hover:text-ink"
          >
            <CloseIcon className="size-3.5" />
          </RadixDialog.Close>
        </div>
        {description ? (
          <RadixDialog.Description className="mb-4 text-sm text-ink-muted">
            {description}
          </RadixDialog.Description>
        ) : null}
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/* ---------- Popover ---------- */

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

/** Radix renders popover content as role="dialog", so it needs an accessible name. */
export function PopoverContent({
  className,
  sideOffset = 6,
  label,
  ...props
}: ComponentProps<typeof RadixPopover.Content> & { label: string }) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={sideOffset}
        aria-label={label}
        className={cx(panel, "z-(--z-dropdown) w-72 p-4 text-sm", className)}
        {...props}
      />
    </RadixPopover.Portal>
  );
}

/* ---------- Tooltip ---------- */

export const TooltipProvider = RadixTooltip.Provider;

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RadixTooltip.Root delayDuration={300}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-(--z-dropdown) max-w-64 rounded-sm bg-ink px-2 py-1 text-xs text-bg"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
