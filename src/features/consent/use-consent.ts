"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  CONSENT_EVENT,
  CONSENT_KEY,
  NO_CONSENT,
  parseConsent,
  withChoice,
  type Category,
  type Consent,
} from "./consent";

/** The stored choice; essential-only when storage is unavailable (private mode, SSR). */
function read(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CONSENT_EVENT, onChange);
  };
}

/** Saves a choice and tells every component on the page (and other tabs, via storage). */
export function saveConsent(choice: Partial<Record<Category, boolean>>): void {
  const next = withChoice(parseConsent(read()), choice, new Date());
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Outside React (e.g. before loading an analytics script). */
export const hasConsent = (category: Category): boolean => parseConsent(read())[category];

export function useConsent(): [Consent, (choice: Partial<Record<Category, boolean>>) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const consent = raw === null ? NO_CONSENT : parseConsent(raw);
  const save = useCallback((choice: Partial<Record<Category, boolean>>) => {
    saveConsent(choice);
  }, []);
  return [consent, save];
}
