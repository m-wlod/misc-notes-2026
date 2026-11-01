/**
 * Seeded pseudo-random numbers for reproducible figures and simulations.
 * mulberry32: fast, 32-bit state, good enough for visuals (not for cryptography).
 */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draws via Box–Muller. */
export function normal(rand: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

/** Geometric random walk: P_t = P_{t-1} · exp(μ + σ·Z). */
export function randomWalk({
  steps,
  sigma,
  mu = 0,
  start = 100,
  seed,
}: {
  steps: number;
  sigma: number;
  mu?: number;
  start?: number;
  seed: number;
}): number[] {
  const z = normal(mulberry32(seed));
  const path = [start];
  for (let i = 1; i < steps; i++) {
    path.push((path[i - 1] ?? start) * Math.exp(mu + sigma * z()));
  }
  return path;
}
