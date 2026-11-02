"use client";

import { useSyncExternalStore } from "react";

import { LOCAL_PROGRESS_KEY, localProgressSchema } from "@/features/progress/schema";

import { solvedIds } from "./local-attempts";

/** Ids of exercises solved (score 1) in this browser; empty during server rendering. */
const EMPTY = new Set<string>();
let lastRaw: string | null | undefined;
let lastValue: ReadonlySet<string> = EMPTY;

function read(): ReadonlySet<string> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return lastValue;
  lastRaw = raw;
  try {
    const parsed = raw ? localProgressSchema.safeParse(JSON.parse(raw)) : null;
    lastValue = parsed?.success ? solvedIds(parsed.data) : EMPTY;
  } catch {
    lastValue = EMPTY;
  }
  return lastValue;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}

export function useSolvedIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
