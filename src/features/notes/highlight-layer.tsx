"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { findQuote, quoteAt, withHighlight, type Highlight } from "./storage";
import { saveNotes, useNotes } from "./use-notes";

const NAME = "qla-highlight";

/** Text offsets of a DOM position inside `root` (Range text = the root's text nodes). */
function offsetOf(root: Element, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** A Range covering [start, end) of `root`'s text, or null if out of bounds. */
function rangeAt(root: Element, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0;
    if (!started && start <= pos + len) {
      range.setStart(node, start - pos);
      started = true;
    }
    if (started && end <= pos + len) {
      range.setEnd(node, end - pos);
      return range;
    }
    pos += len;
  }
  return null;
}

/**
 * Highlights on a lesson, drawn with the CSS Custom Highlight API: nothing is inserted
 * into the server-rendered text, so math and layout stay untouched. Selecting text shows
 * a "Zaznacz" button; highlights are stored as text quotes and found again on load.
 * Browsers without the API simply don't offer highlighting.
 */
export function HighlightLayer({ lessonId, rootId }: { lessonId: string; rootId: string }) {
  const t = useTranslations("notes");
  const notes = useNotes();
  const [tool, setTool] = useState<{ x: number; y: number } | null>(null);
  const supported = typeof CSS !== "undefined" && "highlights" in CSS;
  // Stable between renders (useNotes caches the parsed state), so the effect only re-runs on change.
  const highlights: readonly Highlight[] | undefined = notes?.lessons[lessonId]?.highlights;

  // Draw stored highlights.
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!supported || !root) return;
    const text = root.textContent;
    const ranges = (highlights ?? []).flatMap((h) => {
      const at = findQuote(text, h);
      const range = at === -1 ? null : rangeAt(root, at, at + h.exact.length);
      return range ? [range] : [];
    });
    CSS.highlights.set(NAME, new globalThis.Highlight(...ranges));
    return () => {
      CSS.highlights.delete(NAME);
    };
  }, [highlights, rootId, supported]);

  // Offer the button for a selection inside the lesson.
  useEffect(() => {
    if (!supported) return;
    const onChange = () => {
      const root = document.getElementById(rootId);
      const selection = document.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (
        !root ||
        !range ||
        range.collapsed ||
        range.toString().trim().length < 2 ||
        !root.contains(range.commonAncestorContainer)
      ) {
        setTool(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      // Above the selection, but always inside the viewport (it is position: fixed).
      const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
      setTool({
        x: clamp(rect.left + rect.width / 2, 56, window.innerWidth - 56),
        y: clamp(rect.top - 44, 8, window.innerHeight - 48),
      });
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
    };
  }, [rootId, supported]);

  const save = useCallback(() => {
    const root = document.getElementById(rootId);
    const selection = document.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const start = offsetOf(root, range.startContainer, range.startOffset);
    const end = offsetOf(root, range.endContainer, range.endOffset);
    const quote = quoteAt(root.textContent, start, end);
    saveNotes((raw) =>
      withHighlight(raw, lessonId, { ...quote, id: crypto.randomUUID() }, new Date()),
    );
    selection.removeAllRanges();
    setTool(null);
  }, [lessonId, rootId]);

  if (!tool) return null;
  return (
    <button
      type="button"
      // Keep the selection: a mousedown would otherwise clear it before the click.
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={save}
      style={{ left: tool.x, top: tool.y }}
      className="fixed z-(--z-dropdown) -translate-x-1/2 rounded border border-bg bg-ink px-3 py-1.5 font-sans text-sm text-bg print:hidden"
    >
      {t("highlight")}
    </button>
  );
}
