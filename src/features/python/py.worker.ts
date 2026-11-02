/// <reference lib="webworker" />
import type { PyodideAPI } from "pyodide";

import { QLA_MODULE, RUNNER } from "./bootstrap";
import type { FromWorker, ToWorker } from "./protocol";
import { usesMatplotlib } from "./protocol";
import { PYODIDE_URL } from "./version";

/**
 * Runs Python with Pyodide (Phase 13). Loaded only when a learner opens or runs a cell.
 * There is no interrupt: the page stops a run by terminating this worker (a real
 * interrupt needs cross-origin isolation, which the rest of the site can't have).
 */
type PyProxyLike = { toJs: () => unknown; destroy: () => void };

const post = (m: FromWorker, transfer: Transferable[] = []) => {
  self.postMessage(m, transfer);
};

/** A name defined at the top level of the runner (see bootstrap.ts). */
const global = (py: PyodideAPI, name: string): unknown =>
  (py.globals as unknown as { get: (n: string) => unknown }).get(name);

let current = 0;
let ready: Promise<PyodideAPI> | null = null;
const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };

function asFloats(v: unknown): Float64Array | null {
  if (v === null || v === undefined) return null;
  const proxy = v as PyProxyLike;
  const list = proxy.toJs() as number[];
  proxy.destroy();
  return Float64Array.from(list);
}

async function boot(origin: string, lang: "pl" | "en"): Promise<PyodideAPI> {
  post({ type: "progress", stage: "runtime" });
  // Turbopack ships this worker as a classic script, and Pyodide refuses classic workers
  // (it probes importScripts). Our bundle is already loaded, so hide importScripts:
  // Pyodide then takes its module-worker path, dynamic import(), which classic workers
  // support in every current browser.
  (self as unknown as { importScripts?: unknown }).importScripts = undefined;
  const { loadPyodide } = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${PYODIDE_URL}pyodide.mjs`
  )) as { loadPyodide: (o: { indexURL: string }) => Promise<PyodideAPI> };
  const py = await loadPyodide({ indexURL: PYODIDE_URL });
  const writer = (type: "stdout" | "stderr") => ({
    write(buffer: Uint8Array) {
      post({ type, id: current, text: decoders[type].decode(buffer, { stream: true }) });
      return buffer.length;
    },
  });
  py.setStdout(writer("stdout"));
  py.setStderr(writer("stderr"));
  py.registerJsModule("_qla_js", {
    plot(
      kind: "line" | "hist",
      label: string | null,
      x: unknown,
      y: unknown,
      bins: number,
      dates: boolean,
    ) {
      const xs = asFloats(x);
      const ys = asFloats(y) ?? new Float64Array();
      post(
        {
          type: "plot",
          id: current,
          plot: { kind, label: label ?? null, x: xs, y: ys, bins, xDates: dates },
        },
        xs ? [xs.buffer, ys.buffer] : [ys.buffer],
      );
    },
  });
  (py.FS as unknown as { writeFile: (p: string, d: string) => void }).writeFile(
    "/home/pyodide/qla.py",
    QLA_MODULE,
  );
  await py.runPythonAsync(
    `import sys\nsys.path.insert(0, "/home/pyodide")\nimport qla\nqla._ORIGIN = ${JSON.stringify(origin)}\nqla._LANG = ${JSON.stringify(lang)}\n${RUNNER}`,
  );
  // Cross-origin timings are visible because jsDelivr sends Timing-Allow-Origin: *.
  const files = performance
    .getEntriesByType("resource")
    .filter((e) => e.name.startsWith(PYODIDE_URL)) as PerformanceResourceTiming[];
  const cached = files.length > 0 && files.every((e) => e.transferSize === 0);
  post({ type: "progress", stage: "ready", cached });
  return py;
}

/** Packages a cell needs beyond what its imports show (qla.load reads CSVs with pandas). */
const extraPackages = (code: string) => (/\b(?:qla\.)?load\s*\(/.test(code) ? ["pandas"] : []);

async function run(py: PyodideAPI, id: number, code: string, ns: string) {
  current = id;
  if (usesMatplotlib(code)) {
    post({ type: "refused", id, reason: "matplotlib" });
    return;
  }
  // Pyodide's own "Loading …" lines become progress, not the learner's output.
  const quiet = {
    messageCallback(message: string) {
      const m = /^Loading (.+)$/.exec(message);
      if (m?.[1]) post({ type: "progress", stage: "packages", packages: m[1].split(/,\s*/) });
    },
    errorCallback(message: string) {
      post({ type: "stderr", id, text: `${message}\n` });
    },
  };
  await py.loadPackagesFromImports(code, quiet);
  const extra = extraPackages(code).filter((p) => !(p in py.loadedPackages));
  if (extra.length > 0) await py.loadPackage(extra, quiet);
  post({ type: "started", id });
  const started = performance.now();
  const runCell = global(py, "_run") as (c: string, n: string) => Promise<PyProxyLike>;
  const out = await runCell(code, ns);
  // Python's None arrives as undefined.
  const [value, error] = out.toJs() as [string | undefined, string | undefined];
  out.destroy();
  post({
    type: "done",
    id,
    value: value ?? null,
    error: error ?? null,
    ms: Math.round(performance.now() - started),
  });
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "init") {
    ready ??= boot(msg.origin, msg.lang);
    ready.catch((err: unknown) => {
      post({ type: "fatal", message: err instanceof Error ? err.message : String(err) });
    });
    return;
  }
  if (!ready) return;
  void ready.then(async (py) => {
    if (msg.type === "reset") {
      (global(py, "_reset") as (n: string) => void)(msg.ns);
      return;
    }
    try {
      await run(py, msg.id, msg.code, msg.ns);
    } catch (err) {
      post({
        type: "done",
        id: msg.id,
        value: null,
        error: err instanceof Error ? err.message : String(err),
        ms: 0,
      });
    }
  });
};
