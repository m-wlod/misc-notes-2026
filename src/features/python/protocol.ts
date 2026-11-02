/**
 * Messages between the page and the Python worker (Phase 13), and the pure reducer that
 * turns a run's messages into what the output panel shows.
 */

export type PlotKind = "line" | "hist";

/** One plot as sent by `qla.show` / `qla.hist` (values not yet cleaned). */
export type RawPlot = {
  kind: PlotKind;
  label: string | null;
  x: Float64Array | null;
  y: Float64Array;
  bins: number;
  /** x holds dates as milliseconds since 1970 (a pandas DatetimeIndex, for example). */
  xDates: boolean;
};

/** Steps of the first load, reported as they really happen. */
export type LoadStage = "runtime" | "ready" | "packages";

export type ToWorker =
  | { type: "init"; origin: string; lang: "pl" | "en" }
  | { type: "run"; id: number; code: string; ns: string }
  | { type: "reset"; ns: string };

export type FromWorker =
  /** `cached`: every runtime file came from the browser cache (resource timing). */
  | { type: "progress"; stage: LoadStage; packages?: string[]; cached?: boolean }
  /** Packages are in; the code itself starts now (the time limit counts from here). */
  | { type: "started"; id: number }
  | { type: "stdout"; id: number; text: string }
  | { type: "stderr"; id: number; text: string }
  | { type: "plot"; id: number; plot: RawPlot }
  | { type: "done"; id: number; value: string | null; error: string | null; ms: number }
  /** Code that can't run here (for example matplotlib); the page explains in its language. */
  | { type: "refused"; id: number; reason: "matplotlib" }
  | { type: "fatal"; message: string };

export type RunStatus = "queued" | "loading" | "running" | "done" | "error" | "stopped";

export type RunOutput = {
  status: RunStatus;
  /** Interleaved stdout and stderr, in order. */
  stream: { kind: "out" | "err"; text: string }[];
  plots: RawPlot[];
  value: string | null;
  error: string | null;
  refused: "matplotlib" | null;
  /** Why a run ended early: the user pressed Stop, or the time limit. */
  stopped: "user" | "timeout" | null;
  ms: number | null;
};

export const emptyOutput = (status: RunStatus = "queued"): RunOutput => ({
  status,
  stream: [],
  plots: [],
  value: null,
  error: null,
  refused: null,
  stopped: null,
  ms: null,
});

/** Output kept per run, so a runaway print loop can't freeze the page. */
export const MAX_STREAM_CHARS = 100_000;
export const MAX_PLOTS = 12;

export type OutputEvent =
  | Exclude<FromWorker, { type: "progress" } | { type: "fatal" } | { type: "started" }>
  | { type: "status"; status: RunStatus }
  | { type: "stopped"; why: "user" | "timeout" }
  | { type: "crash"; message: string };

const streamLength = (s: RunOutput["stream"]) => s.reduce((n, c) => n + c.text.length, 0);

export function reduceOutput(state: RunOutput, ev: OutputEvent): RunOutput {
  switch (ev.type) {
    case "status":
      return { ...state, status: ev.status };
    case "stdout":
    case "stderr": {
      const kind: "out" | "err" = ev.type === "stdout" ? "out" : "err";
      const used = streamLength(state.stream);
      if (used >= MAX_STREAM_CHARS) return state;
      const text = ev.text.slice(0, MAX_STREAM_CHARS - used);
      const last = state.stream.at(-1);
      const stream =
        last?.kind === kind
          ? [...state.stream.slice(0, -1), { kind, text: last.text + text }]
          : [...state.stream, { kind, text }];
      return { ...state, stream };
    }
    case "plot":
      return state.plots.length >= MAX_PLOTS
        ? state
        : { ...state, plots: [...state.plots, ev.plot] };
    case "done":
      return {
        ...state,
        status: ev.error ? "error" : "done",
        value: ev.value,
        error: ev.error,
        ms: ev.ms,
      };
    case "refused":
      return { ...state, status: "error", refused: ev.reason };
    case "stopped":
      return { ...state, status: "stopped", stopped: ev.why };
    case "crash":
      return { ...state, status: "error", error: ev.message };
  }
}

/** True for imports we don't load (matplotlib is big and draws in its own style). */
export const usesMatplotlib = (code: string) =>
  /^\s*(?:import|from)\s+(?:matplotlib|pylab)\b/m.test(code);
