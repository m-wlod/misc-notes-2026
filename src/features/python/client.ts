import { emptyOutput, type FromWorker, type OutputEvent, type ToWorker } from "./protocol";

/**
 * The page's Python runtime (Phase 13): one worker per page, shared by every cell, so
 * cells see each other's variables like in Jupyter. Runs are queued one at a time.
 * Stop and the time limit terminate the worker; the next run starts a fresh one (from
 * the browser cache) with empty namespaces.
 */
export type RuntimePhase = "idle" | "loading" | "ready" | "failed";
export type RuntimeState = {
  phase: RuntimePhase;
  /** Packages being downloaded right now, if any. */
  packages: string[] | null;
  /** How many times the runtime was restarted (Stop, time limit, Restart). */
  restarts: number;
  error: string | null;
  /** The last load came entirely from the browser cache (null until loaded). */
  cached: boolean | null;
};

export const DEFAULT_TIMEOUT_MS = 10_000;

type Job = {
  id: number;
  code: string;
  ns: string;
  timeoutMs: number;
  emit: (ev: OutputEvent) => void;
  resolve: () => void;
};

class PythonRuntime {
  private worker: Worker | null = null;
  private queue: Job[] = [];
  private active: Job | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 1;
  private listeners = new Set<() => void>();
  state: RuntimeState = {
    phase: "idle",
    packages: null,
    restarts: 0,
    error: null,
    cached: null,
  };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<RuntimeState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Starts loading Pyodide (opening a cell calls this, so the first run waits less). */
  warm(lang: "pl" | "en") {
    if (this.worker) return;
    this.set({ phase: "loading", error: null });
    const w = new Worker(new URL("./py.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      this.onMessage(e.data);
    };
    w.onerror = (e) => {
      this.fail(e.message || "worker error");
    };
    w.postMessage({ type: "init", origin: location.origin, lang } satisfies ToWorker);
    this.worker = w;
    this.lang = lang;
  }
  private lang: "pl" | "en" = "pl";

  run(code: string, opts: { ns?: string; timeoutMs?: number; emit: (ev: OutputEvent) => void }) {
    const id = this.nextId++;
    return {
      id,
      done: new Promise<void>((resolve) => {
        this.queue.push({
          id,
          code,
          ns: opts.ns ?? "main",
          timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          emit: opts.emit,
          resolve,
        });
        opts.emit({ type: "status", status: "queued" });
        this.pump();
      }),
    };
  }

  /** Clears a namespace's variables (a fresh start for a cell or a test run). */
  reset(ns: string) {
    this.worker?.postMessage({ type: "reset", ns } satisfies ToWorker);
  }

  /** Stops the running code and drops queued runs; all variables are lost. */
  stop(why: "user" | "timeout" = "user") {
    const jobs = [...(this.active ? [this.active] : []), ...this.queue];
    this.queue = [];
    this.active = null;
    this.kill();
    for (const job of jobs) {
      job.emit({ type: "stopped", why });
      job.resolve();
    }
  }

  /** A clean runtime with no variables. */
  restart() {
    this.stop("user");
    this.warm(this.lang);
  }

  private kill() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.worker?.terminate();
    this.worker = null;
    this.set({ phase: "idle", packages: null, restarts: this.state.restarts + 1 });
  }

  private fail(message: string) {
    const jobs = [...(this.active ? [this.active] : []), ...this.queue];
    this.queue = [];
    this.active = null;
    this.worker?.terminate();
    this.worker = null;
    this.set({ phase: "failed", packages: null, error: message });
    for (const job of jobs) {
      job.emit({ type: "crash", message });
      job.resolve();
    }
  }

  private pump() {
    if (this.active || this.queue.length === 0) return;
    const job = this.queue.shift();
    if (!job) return;
    this.active = job;
    this.warm(this.lang);
    job.emit({ type: "status", status: "loading" });
    this.worker?.postMessage({
      type: "run",
      id: job.id,
      code: job.code,
      ns: job.ns,
    } satisfies ToWorker);
  }

  private onMessage(m: FromWorker) {
    if (m.type === "progress") {
      if (m.stage === "ready")
        this.set({ phase: "ready", packages: null, cached: m.cached ?? null });
      else if (m.stage === "packages") this.set({ packages: m.packages ?? null });
      return;
    }
    if (m.type === "fatal") {
      this.fail(m.message);
      return;
    }
    const job = this.active;
    if (!job || m.id !== job.id) return;
    if (m.type === "started") {
      this.set({ packages: null });
      job.emit({ type: "status", status: "running" });
      this.timer = setTimeout(() => {
        this.stop("timeout");
      }, job.timeoutMs);
      return;
    }
    job.emit(m);
    if (m.type === "done" || m.type === "refused") {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.active = null;
      job.resolve();
      this.pump();
    }
  }
}

let runtime: PythonRuntime | null = null;
export function getRuntime(): PythonRuntime {
  runtime ??= new PythonRuntime();
  return runtime;
}
export type { PythonRuntime };
export { emptyOutput };
