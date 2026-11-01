"use client";

import { useSyncExternalStore } from "react";

import {
  LOCAL_PROGRESS_KEY,
  localProgressSchema,
  type LessonStatus,
} from "@/features/progress/schema";

import type { Statuses } from "./node-state";

/**
 * Lesson statuses saved in this browser (signed-out progress, Phase 3 schema).
 * null until mounted: the server can't know, so nodes render neutral first.
 * Invalid or foreign data counts as no progress.
 */
const EMPTY: Statuses = new Map();
let lastRaw: string | null | undefined;
let lastValue: Statuses = EMPTY;

function read(): Statuses {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return lastValue;
  lastRaw = raw;
  lastValue = parse(raw);
  return lastValue;
}

export function parse(raw: string | null): Statuses {
  if (!raw) return EMPTY;
  try {
    const parsed = localProgressSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return EMPTY;
    return new Map(
      Object.entries(parsed.data.lessons).map(
        ([id, v]) => [id, v.status] as [string, LessonStatus],
      ),
    );
  } catch {
    return EMPTY;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}

export function useLocalProgress(): Statuses | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
