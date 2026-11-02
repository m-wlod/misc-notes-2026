import type { Params, SimData, SimDef } from "./types";

/**
 * Computes a simulation's data: in the shared Web Worker when the simulation asks for
 * it (heavy data), on the main thread otherwise or when a worker can't start.
 */
let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (d: SimData) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; data?: SimData; error?: string }>) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.data) job.resolve(e.data.data);
      else job.reject(new Error(e.data.error ?? "worker failed"));
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error("worker crashed"));
      pending.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

export async function computeSim(def: SimDef, params: Params, seed: number): Promise<SimData> {
  const w = def.worker ? getWorker() : null;
  if (!w) return def.compute(params, seed);
  const id = nextId++;
  try {
    return await new Promise<SimData>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ id, sim: def.id, params, seed });
    });
  } catch {
    return def.compute(params, seed);
  }
}
