/// <reference lib="webworker" />
import { simById } from "./registry";
import type { Params } from "./types";

/**
 * Runs a simulation's `compute` off the main thread (Phase 12) and transfers its typed
 * arrays back without copying.
 */
type Job = { id: number; sim: string; params: Params; seed: number };

self.onmessage = (e: MessageEvent<Job>) => {
  const { id, sim, params, seed } = e.data;
  const def = simById(sim);
  if (!def) {
    self.postMessage({ id, error: "unknown simulation" });
    return;
  }
  const data = def.compute(params, seed);
  const transfer = (Object.values(data) as unknown[])
    .filter((v): v is ArrayBufferView => ArrayBuffer.isView(v))
    .map((v) => v.buffer as ArrayBuffer);
  self.postMessage({ id, data }, { transfer: [...new Set(transfer)] });
};
