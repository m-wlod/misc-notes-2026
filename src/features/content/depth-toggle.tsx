"use client";

import { useTranslations } from "next-intl";
import { RadioGroup } from "radix-ui";
import { useSyncExternalStore } from "react";

import { selectOnKeyboardFocus } from "@/components/ui/choice";
import { DEPTH_STORAGE_KEY, DEPTHS, pickDepth, type Depth } from "@/config/depth";

const EVENT = "qla:depth";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
  };
}
const read = () => pickDepth(document.documentElement.dataset.depth);

function setDepth(depth: Depth) {
  document.documentElement.dataset.depth = depth;
  try {
    localStorage.setItem(DEPTH_STORAGE_KEY, depth);
  } catch {
    // Private mode: the choice still applies to this page.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Po ludzku / Podręcznik, as a segmented radio group (same pattern as the theme switch). */
export function DepthToggle() {
  const t = useTranslations("content.depth");
  // The current depth lives on <html> (set before paint); unknown during SSR.
  const depth = useSyncExternalStore(subscribe, read, () => null);

  return (
    <RadioGroup.Root
      aria-label={t("group")}
      orientation="horizontal"
      value={depth ?? ""}
      onValueChange={(v) => {
        setDepth(pickDepth(v));
      }}
      className="inline-flex rounded border border-rule-strong font-sans"
    >
      {DEPTHS.map((value) => (
        <RadioGroup.Item
          key={value}
          value={value}
          onFocus={selectOnKeyboardFocus(() => {
            setDepth(value);
          })}
          className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink data-[state=checked]:bg-ink data-[state=checked]:text-bg"
        >
          {t(value)}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
