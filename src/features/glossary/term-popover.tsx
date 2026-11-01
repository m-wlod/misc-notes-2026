"use client";

import { useRef, useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Link } from "@/i18n/navigation";

type TermPopoverProps = {
  id: string;
  name: string;
  definition: string;
  linkLabel: string;
  children: ReactNode;
};

const HOVER_CLOSE_MS = 150;

/**
 * A glossary term in running text. A real button, so it opens with Enter/Space and a
 * tap; with a mouse it also opens on hover. Radix HoverCard is skipped on purpose:
 * it can't be opened from the keyboard or on touch.
 */
export function TermPopover({ id, name, definition, linkLabel, children }: TermPopoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    if (next) setOpen(true);
    else
      closeTimer.current = window.setTimeout(() => {
        setOpen(false);
      }, HOVER_CLOSE_MS);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        className="cursor-help rounded-sm text-left underline decoration-ink-muted decoration-dotted underline-offset-4 hover:decoration-ink"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        label={name}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        className="font-sans"
      >
        <p className="mb-1 font-semibold text-ink">{name}</p>
        <p className="mb-3 text-ink-muted">{definition}</p>
        <Link
          href={{ pathname: "/glossary", hash: id }}
          className="text-accent-text underline underline-offset-2"
        >
          {linkLabel}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
