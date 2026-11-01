"use client";

import { useSyncExternalStore } from "react";

import { store } from "@/features/reader/storage";

import { NOTES_KEY, parseNotes, type NotesState } from "./storage";

/** Notes state from this browser; null during server rendering. */
let lastRaw: string | null | undefined;
let lastValue: NotesState = { version: 1, lessons: {} };

function read(): NotesState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(NOTES_KEY);
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastValue = parseNotes(raw);
  }
  return lastValue;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}

export function useNotes(): NotesState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Apply a pure change to the stored notes (see storage.ts) and notify listeners. */
export function saveNotes(change: (raw: string | null) => string): void {
  store(NOTES_KEY, change);
}
