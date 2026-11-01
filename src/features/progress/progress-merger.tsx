"use client";

import { useEffect } from "react";

import { mergeAnonymousProgress } from "./actions";
import { LOCAL_PROGRESS_KEY, localProgressSchema } from "./schema";

/**
 * Rendered only for signed-in users. If the browser still holds progress from before
 * sign-in, send it to the server once and clear it on success. Storage access is
 * wrapped: private windows and blocked storage simply mean there is nothing to merge.
 */
export function ProgressMerger() {
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(LOCAL_PROGRESS_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    const parsed = localProgressSchema.safeParse(payload);
    if (!parsed.success) {
      // Corrupt or outdated data can never be merged; drop it rather than retry forever.
      try {
        window.localStorage.removeItem(LOCAL_PROGRESS_KEY);
      } catch {
        // ignore
      }
      return;
    }
    if (Object.keys(parsed.data.lessons).length === 0 && parsed.data.attempts.length === 0) return;

    void mergeAnonymousProgress(parsed.data).then((result) => {
      if (!result.ok) return; // keep it; the next page load retries (the merge is idempotent)
      try {
        window.localStorage.removeItem(LOCAL_PROGRESS_KEY);
      } catch {
        // ignore
      }
    });
  }, []);

  return null;
}
