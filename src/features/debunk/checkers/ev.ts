/**
 * Strategy EV checker (Phase 16), exact maths, no simulation. A strategy is a sequence
 * of independent trades: win W with probability p, lose L otherwise, and pay c in fees
 * and slippage every trade.
 */
export type EvInput = {
  /** Win rate, 0–1. */
  p: number;
  /** Average win and average loss (both positive, in money). */
  win: number;
  loss: number;
  /** Fees + slippage per trade (money). */
  cost: number;
};

/** Expected value per trade. */
export const expectedValue = ({ p, win, loss, cost }: EvInput) => p * win - (1 - p) * loss - cost;

/** The win rate at which EV is zero: (L + c) / (W + L). */
export const breakEvenWinRate = ({ win, loss, cost }: Omit<EvInput, "p">) =>
  (loss + cost) / (win + loss);

/**
 * P(at least one losing streak of length ≥ k in n trades), exactly: dynamic programming
 * over the length of the current losing streak (absorbing once it reaches k).
 */
export function losingStreakProbability(p: number, n: number, k: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  const q = 1 - p;
  // state[j]: probability of a current streak of j losses (j < k) and no k-streak yet.
  let state = new Float64Array(k);
  state[0] = 1;
  let hit = 0;
  for (let t = 0; t < n; t++) {
    const next = new Float64Array(k);
    for (let j = 0; j < k; j++) {
      const s = state[j] ?? 0;
      if (s === 0) continue;
      next[0] = (next[0] ?? 0) + s * p;
      if (j + 1 === k) hit += s * q;
      else next[j + 1] = (next[j + 1] ?? 0) + s * q;
    }
    state = next;
  }
  return hit;
}

/** log of n choose k (via log-gamma-free summation; n is at most a few thousand). */
function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  const m = Math.min(k, n - k);
  let s = 0;
  for (let i = 1; i <= m; i++) s += Math.log(n - m + i) - Math.log(i);
  return s;
}

/** Binomial probabilities P(X = k), k = 0..n, computed in log space (stable for large n). */
export function binomialPmf(n: number, p: number): Float64Array {
  const out = new Float64Array(n + 1);
  if (p <= 0) {
    out[0] = 1;
    return out;
  }
  if (p >= 1) {
    out[n] = 1;
    return out;
  }
  const lp = Math.log(p);
  const lq = Math.log(1 - p);
  for (let k = 0; k <= n; k++) out[k] = Math.exp(logChoose(n, k) + k * lp + (n - k) * lq);
  return out;
}

/**
 * Equity after n trades, exactly: with k wins it is C + kW − (n−k)L − nc, with the
 * binomial probability of k wins.
 */
export function equityDistribution(
  input: EvInput,
  capital: number,
  n: number,
): { equity: number; probability: number }[] {
  const pmf = binomialPmf(n, input.p);
  return Array.from(pmf, (prob, k) => ({
    equity: capital + k * input.win - (n - k) * input.loss - n * input.cost,
    probability: prob,
  }));
}

/**
 * P(equity touches or falls below `ruinAt` within n trades), exactly. Equity after t
 * trades depends only on the number of wins so far, so a DP over (t, wins) with an
 * absorbing barrier gives the answer in O(n²).
 */
export function riskOfRuin(input: EvInput, capital: number, n: number, ruinAt: number): number {
  if (capital <= ruinAt) return 1;
  const { p, win, loss, cost } = input;
  let alive = new Float64Array(n + 1);
  alive[0] = 1;
  let ruined = 0;
  for (let t = 0; t < n; t++) {
    const next = new Float64Array(n + 1);
    for (let w = 0; w <= t; w++) {
      const s = alive[w] ?? 0;
      if (s === 0) continue;
      // After a win (w + 1 wins in t + 1 trades) or a loss (w wins).
      const afterWin = capital + (w + 1) * win - (t - w) * loss - (t + 1) * cost;
      const afterLoss = capital + w * win - (t + 1 - w) * loss - (t + 1) * cost;
      if (afterWin <= ruinAt) ruined += s * p;
      else next[w + 1] = (next[w + 1] ?? 0) + s * p;
      if (afterLoss <= ruinAt) ruined += s * (1 - p);
      else next[w] = (next[w] ?? 0) + s * (1 - p);
    }
    alive = next;
  }
  return Math.min(1, ruined);
}
