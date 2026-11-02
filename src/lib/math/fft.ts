/**
 * Radix-2 Fourier transform for the simulations (Phase 12). In place on separate real
 * and imaginary arrays; the length must be a power of two.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error("fft: length must be a power of two");
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = (re[b] ?? 0) * cr - (im[b] ?? 0) * ci;
        const ti = (re[b] ?? 0) * ci + (im[b] ?? 0) * cr;
        re[b] = (re[a] ?? 0) - tr;
        im[b] = (im[a] ?? 0) - ti;
        re[a] = (re[a] ?? 0) + tr;
        im[a] = (im[a] ?? 0) + ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** Power at frequencies 0…n/2 of a real signal (|X_k|² / n). */
export function powerSpectrum(signal: ArrayLike<number>): Float64Array {
  const n = signal.length;
  const re = Float64Array.from({ length: n }, (_, i) => signal[i] ?? 0);
  const im = new Float64Array(n);
  fft(re, im);
  return Float64Array.from(
    { length: n / 2 + 1 },
    (_, k) => ((re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2) / n,
  );
}
