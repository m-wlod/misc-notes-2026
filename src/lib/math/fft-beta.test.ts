import { describe, expect, it } from "vitest";

import { betaPdf, betaQuantiles, betaTail, logGamma } from "./beta";
import { powerSpectrum } from "./fft";

describe("FFT", () => {
  it("puts a pure sine's power at its frequency", () => {
    const n = 256;
    const sig = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / n));
    const p = powerSpectrum(sig);
    const peak = p.indexOf(Math.max(...p));
    expect(peak).toBe(8);
    expect(p[8]).toBeCloseTo(n / 4, 6); // |X_8| = n/2 → power n/4
  });

  it("keeps the energy (Parseval)", () => {
    const n = 128;
    const sig = Array.from({ length: n }, (_, i) => Math.cos(i * 0.37) + 0.5 * Math.sin(i * 1.3));
    const energy = sig.reduce((s, v) => s + v * v, 0);
    const p = powerSpectrum(sig);
    // Full spectrum = k=0 and n/2 once, the rest twice (conjugate symmetry).
    let total = (p[0] ?? 0) + (p[n / 2] ?? 0);
    for (let k = 1; k < n / 2; k++) total += 2 * (p[k] ?? 0);
    expect(total).toBeCloseTo(energy, 6);
  });
});

describe("Beta", () => {
  it("log-gamma matches factorials", () => {
    expect(Math.exp(logGamma(5))).toBeCloseTo(24, 8);
    expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 8);
  });

  it("density, quantiles and tail of known cases", () => {
    expect(betaPdf(0.3, 1, 1)).toBeCloseTo(1, 10);
    expect(betaPdf(0.5, 2, 2)).toBeCloseTo(1.5, 10);
    const [lo, mid, hi] = betaQuantiles(1, 1, [0.025, 0.5, 0.975]);
    expect(lo).toBeCloseTo(0.025, 2);
    expect(mid).toBeCloseTo(0.5, 2);
    expect(hi).toBeCloseTo(0.975, 2);
    expect(betaTail(0.5, 10, 10)).toBeCloseTo(0.5, 2);
    expect(betaTail(0.5, 30, 10)).toBeGreaterThan(0.99);
  });
});
