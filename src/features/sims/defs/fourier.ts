import { powerSpectrum } from "@/lib/math/fft";
import { mulberry32, normal } from "@/lib/math/rng";

import { num, str } from "../params";
import type { SimDef } from "../types";

/**
 * Fourier decomposition: build a signal from three sines (plus noise) and see its
 * spectrum: three clean peaks. Then the spectrum of a random walk: no peaks at all, just
 * power falling off like 1/f². "Cycles" in prices are mostly that slope.
 */
export type FourierData = {
  T: number;
  source: "sines" | "walk";
  signal: Float32Array;
  /** log10 power at frequencies 1…N/2. */
  logPower: Float32Array;
  /** Fitted slope of log power vs log frequency (≈ −2 for a random walk). */
  slope: number;
  peaks: [number, number, number];
  ylo: number;
  yhi: number;
  plo: number;
  phi: number;
};

const N = 512;
const FREQS = [4, 12, 20] as const;

export const fourier: SimDef<FourierData> = {
  id: "fourier",
  slug: { pl: "fourier-i-widmo", en: "fourier-spectrum" },
  lessonId: "spectral-analysis",
  seconds: 6,
  params: {
    source: { kind: "choice", options: ["sines", "walk"], default: "sines" },
    view: { kind: "choice", options: ["signal", "spectrum"], default: "signal" },
    a1: { kind: "number", min: 0, max: 1, step: 0.05, default: 1 },
    a2: { kind: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    a3: { kind: "number", min: 0, max: 1, step: 0.05, default: 0.3 },
    noise: { kind: "number", min: 0, max: 1, step: 0.05, default: 0.1 },
  },
  compute(p, seed) {
    const z = normal(mulberry32(seed));
    const source = str(p, "source") === "walk" ? "walk" : "sines";
    const amps = [num(p, "a1"), num(p, "a2"), num(p, "a3")];
    const noise = num(p, "noise");
    const signal = new Float32Array(N);
    let w = 0;
    for (let i = 0; i < N; i++) {
      if (source === "walk") {
        w += z();
        signal[i] = w;
      } else {
        let v = noise * z();
        for (let k = 0; k < 3; k++)
          v += (amps[k] ?? 0) * Math.sin((2 * Math.PI * (FREQS[k] ?? 1) * i) / N);
        signal[i] = v;
      }
    }
    // Remove the mean (and, for the walk, the straight line from start to end) so the
    // spectrum shows variation, not the offset.
    const first = signal[0] ?? 0;
    const last = signal[N - 1] ?? 0;
    const detrended = Float32Array.from(signal, (v, i) =>
      source === "walk" ? v - (first + ((last - first) * i) / (N - 1)) : v,
    );
    const m = detrended.reduce((a, b) => a + b, 0) / N;
    const power = powerSpectrum(Array.from(detrended, (v) => v - m));
    const logPower = new Float32Array(N / 2);
    let plo = Infinity;
    let phi = -Infinity;
    for (let k = 1; k <= N / 2; k++) {
      const v = Math.log10(Math.max(1e-6, power[k] ?? 0));
      logPower[k - 1] = v;
      plo = Math.min(plo, v);
      phi = Math.max(phi, v);
    }
    // Least-squares slope of log power on log frequency, over the lower half of frequencies.
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    const K = N / 4;
    for (let k = 1; k <= K; k++) {
      const x = Math.log10(k);
      const y = logPower[k - 1] ?? 0;
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
    }
    const slope = (K * sxy - sx * sy) / (K * sxx - sx * sx);
    const ranked = Array.from(logPower, (v, i) => [v, i + 1] as const).sort((a, b) => b[0] - a[0]);
    let ylo = Infinity;
    let yhi = -Infinity;
    for (const v of signal) {
      ylo = Math.min(ylo, v);
      yhi = Math.max(yhi, v);
    }
    return {
      T: N,
      source,
      signal,
      logPower,
      slope,
      peaks: [ranked[0]?.[1] ?? 0, ranked[1]?.[1] ?? 0, ranked[2]?.[1] ?? 0],
      ylo,
      yhi,
      plo: Math.max(plo, phi - 8),
      phi,
    };
  },
  view(d, p) {
    if (str(p, "view") === "spectrum") {
      // Log–log: a power law (the random walk's 1/f²) is a straight line.
      return {
        x: [0, Math.log10(N / 2)],
        y: [d.plo - 0.3, d.phi + 0.5],
        xLabel: "frequency",
        yLabel: "power",
        xFormat: "log10",
        yFormat: "log10",
      };
    }
    const pad = (d.yhi - d.ylo) * 0.08 || 1;
    return {
      x: [0, N - 1],
      y: [d.ylo - pad, d.yhi + pad],
      xLabel: "time",
      yLabel: "signal",
      xFormat: "int",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c, p) {
    ctx.lineJoin = "round";
    ctx.lineWidth = 2 * plot.px;
    ctx.strokeStyle = c.accent;
    if (str(p, "view") === "spectrum") {
      // Reveal frequencies left to right as bars (stems).
      const k0 = Math.floor((Math.max(0, from - 1) / d.T) * (N / 2));
      const k1 = Math.floor((Math.min(to, d.T) / d.T) * (N / 2));
      ctx.lineWidth = 1.5 * plot.px;
      ctx.beginPath();
      for (let k = Math.max(1, k0); k <= k1; k++) {
        const y = Math.max(plot.y(d.logPower[k - 1] ?? d.plo), plot.top);
        ctx.moveTo(plot.x(Math.log10(k)), plot.top + plot.height);
        ctx.lineTo(plot.x(Math.log10(k)), y);
      }
      ctx.stroke();
      return;
    }
    const start = Math.max(0, from - 1);
    const end = Math.min(to, d.T - 1);
    ctx.beginPath();
    ctx.moveTo(plot.x(start), plot.y(d.signal[start] ?? 0));
    for (let i = start + 1; i <= end; i++) ctx.lineTo(plot.x(i), plot.y(d.signal[i] ?? 0));
    ctx.stroke();
  },
  summary(d) {
    return {
      source: d.source,
      p1: d.peaks[0],
      p2: d.peaks[1],
      p3: d.peaks[2],
      slope: Math.round(d.slope * 100) / 100,
    };
  },
};
