"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { track } from "@/features/analytics/client";

import { getRuntime, type RuntimeState } from "./client";
import { emptyOutput, reduceOutput, type OutputEvent, type RunOutput } from "./protocol";

const IDLE: RuntimeState = {
  phase: "idle",
  packages: null,
  restarts: 0,
  error: null,
  cached: null,
};

/** The shared runtime's load state (idle on the server). */
export function useRuntimeState(): RuntimeState {
  const rt = typeof window === "undefined" ? null : getRuntime();
  return useSyncExternalStore(
    rt ? rt.subscribe : () => () => undefined,
    rt ? rt.getState : () => IDLE,
    () => IDLE,
  );
}

/** Runs code in the page's Python runtime and keeps that run's output. */
export function useRun(ns = "main") {
  const lang = useLocale() === "en" ? "en" : "pl";
  const [output, setOutput] = useState<RunOutput | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const warm = useCallback(() => {
    getRuntime().warm(lang);
  }, [lang]);

  const run = useCallback(
    async (code: string, timeoutMs?: number) => {
      track("feature_used", { feature: "notebook" });
      const rt = getRuntime();
      rt.warm(lang);
      let last = emptyOutput();
      setOutput(last);
      const emit = (ev: OutputEvent) => {
        last = reduceOutput(last, ev);
        if (mounted.current) setOutput(last);
      };
      await rt.run(code, timeoutMs === undefined ? { ns, emit } : { ns, emit, timeoutMs }).done;
      return last;
    },
    [lang, ns],
  );

  const stop = useCallback(() => {
    getRuntime().stop("user");
  }, []);

  const clear = useCallback(() => {
    setOutput(null);
  }, []);

  return { output, run, stop, warm, clear };
}
