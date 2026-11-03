"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { CloseIcon } from "@/components/ui/icons";

/**
 * One announcement with a close button (Phase 18c). Closing it is remembered per
 * announcement in this browser; a new announcement shows again.
 */
const key = (id: number) => `announcement-dismissed:${String(id)}`;

const noSubscribe = () => () => undefined;

function readDismissed(id: number): boolean {
  try {
    return localStorage.getItem(key(id)) === "1";
  } catch {
    // Storage blocked: the banner just stays.
    return false;
  }
}

export function DismissibleAnnouncement({ id, text }: { id: number; text: string }) {
  const t = useTranslations("common.announcement");
  const [closed, setClosed] = useState(false);
  // Shown on the server and in the first render; hidden once the browser says it was closed.
  const remembered = useSyncExternalStore(
    noSubscribe,
    () => readDismissed(id),
    () => false,
  );
  const hidden = closed || remembered;
  if (hidden) return null;
  return (
    <section
      aria-label={t("label")}
      data-announcement={id}
      className="border-b border-rule bg-sunken"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2 font-sans text-sm sm:px-6">
        <p className="flex-1 text-ink">{text}</p>
        <button
          type="button"
          aria-label={t("dismiss")}
          className="-m-1 rounded p-1 text-ink-muted hover:text-ink"
          onClick={() => {
            setClosed(true);
            try {
              localStorage.setItem(key(id), "1");
            } catch {
              // Storage blocked: hidden for this page view only.
            }
          }}
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
    </section>
  );
}
