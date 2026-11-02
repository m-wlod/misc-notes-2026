"use client";

import { useSyncExternalStore } from "react";

import { INTERVIEW_KEY, parseInterview, type InterviewState } from "./store";

let lastRaw: string | null | undefined;
let lastValue: InterviewState | null = null;

function read(): InterviewState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(INTERVIEW_KEY);
  } catch {
    // storage blocked: behave as empty
  }
  if (raw === lastRaw && lastValue) return lastValue;
  lastRaw = raw;
  lastValue = parseInterview(raw);
  return lastValue;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}

/** Interview history in this browser; null during server rendering. */
export function useInterview(): InterviewState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
