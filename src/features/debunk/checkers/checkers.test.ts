import { describe, expect, it } from "vitest";

import { normalCdf } from "@/lib/math/stats";

import {
  binomialPmf,
  breakEvenWinRate,
  equityDistribution,
  expectedValue,
  losingStreakProbability,
  riskOfRuin,
} from "./ev";
import { crossings, ema, evaluate, macd, noiseStudy, rsi, rsiSignals, sma } from "./indicators";
import {
  atLeastOne,
  binomialTail,
  expectedBestSharpe,
  inverseNormalCdf,
  sharpePValue,
} from "./luck";
import {
  bottomShare,
  membersPerLevel,
  POLAND_POPULATION,
  recruitsToBreakEven,
  saturationLevel,
} from "./mlm";

/** Every win/loss sequence of length n with its probability (for brute-force checks). */
function* sequences(n: number, p: number): Generator<{ wins: boolean[]; prob: number }> {
  for (let mask = 0; mask < 2 ** n; mask++) {
    const wins = Array.from({ length: n }, (_, i) => ((mask >> i) & 1) === 1);
    const k = wins.filter(Boolean).length;
    yield { wins, prob: p ** k * (1 - p) ** (n - k) };
  }
}

describe("strategy EV", () => {
  it("expected value and break-even win rate, by hand", () => {
    // 90% wins of 10, 10% losses of 100, 1 in costs: 9 − 10 − 1 = −2 per trade.
    expect(expectedValue({ p: 0.9, win: 10, loss: 100, cost: 1 })).toBeCloseTo(-2);
    // Break-even: (100 + 1) / (10 + 100) = 0.9181…
    expect(breakEvenWinRate({ win: 10, loss: 100, cost: 1 })).toBeCloseTo(101 / 110);
    // A fair 1:1 bet with no costs breaks even at 50%.
    expect(breakEvenWinRate({ win: 1, loss: 1, cost: 0 })).toBe(0.5);
    expect(expectedValue({ p: 0.4, win: 3, loss: 1, cost: 0 })).toBeCloseTo(0.6);
  });

  it("losing streaks: exact DP equals brute force over every sequence", () => {
    for (const [p, n, k] of [
      [0.5, 10, 3],
      [0.6, 12, 4],
      [0.3, 8, 2],
      [0.9, 12, 2],
    ] as const) {
      let brute = 0;
      for (const { wins, prob } of sequences(n, p)) {
        let run = 0;
        let hit = false;
        for (const w of wins) {
          run = w ? 0 : run + 1;
          if (run >= k) hit = true;
        }
        if (hit) brute += prob;
      }
      expect(losingStreakProbability(p, n, k)).toBeCloseTo(brute, 12);
    }
    // By hand: 2 trades, a streak of 2 losses at p = 0.5 is 1/4.
    expect(losingStreakProbability(0.5, 2, 2)).toBeCloseTo(0.25);
    expect(losingStreakProbability(0.5, 3, 5)).toBe(0);
    expect(losingStreakProbability(0.5, 3, 0)).toBe(1);
  });

  it("binomial pmf and the equity distribution", () => {
    const pmf = binomialPmf(4, 0.5);
    [1, 4, 6, 4, 1].forEach((c, k) => {
      expect(pmf[k]).toBeCloseTo(c / 16, 12);
    });
    const dist = equityDistribution({ p: 0.5, win: 2, loss: 1, cost: 0.1 }, 100, 3);
    expect(dist.reduce((s, d) => s + d.probability, 0)).toBeCloseTo(1);
    // 0 wins: 100 − 3 − 0.3 = 96.7; 3 wins: 100 + 6 − 0.3 = 105.7.
    expect(dist[0]?.equity).toBeCloseTo(96.7);
    expect(dist[3]?.equity).toBeCloseTo(105.7);
    expect(binomialPmf(1000, 0.3).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it("risk of ruin: exact DP equals brute force, and less capital means more ruin", () => {
    const input = { p: 0.55, win: 1, loss: 1, cost: 0.05 };
    for (const [capital, n] of [
      [3, 10],
      [5, 12],
      [2, 8],
    ] as const) {
      let brute = 0;
      for (const { wins, prob } of sequences(n, input.p)) {
        let eq = capital;
        for (const w of wins) {
          eq += (w ? input.win : -input.loss) - input.cost;
          if (eq <= 0) {
            brute += prob;
            break;
          }
        }
      }
      expect(riskOfRuin(input, capital, n, 0)).toBeCloseTo(brute, 12);
    }
    expect(riskOfRuin(input, 2, 50, 0)).toBeGreaterThan(riskOfRuin(input, 5, 50, 0));
    expect(riskOfRuin(input, 0, 10, 0)).toBe(1);
    // By hand: capital 1, one losing trade of 1 ruins: P = 1 − p.
    expect(riskOfRuin({ p: 0.7, win: 1, loss: 1, cost: 0 }, 1, 1, 0)).toBeCloseTo(0.3);
  });
});

describe("is this track record luck?", () => {
  it("binomial tail by hand: 8 of 10 at 50% is 56/1024", () => {
    expect(binomialTail(10, 8, 0.5)).toBeCloseTo(56 / 1024, 12);
    expect(binomialTail(10, 0, 0.5)).toBe(1);
    expect(binomialTail(10, 11, 0.5)).toBe(0);
    expect(binomialTail(3, 3, 0.5)).toBeCloseTo(1 / 8);
  });

  it("multiple testing: the chance at least one of M looks this good", () => {
    expect(atLeastOne(0.05, 1)).toBeCloseTo(0.05);
    expect(atLeastOne(0.05, 20)).toBeCloseTo(1 - 0.95 ** 20); // ≈ 0.64
    expect(atLeastOne(56 / 1024, 100)).toBeGreaterThan(0.99);
  });

  it("Sharpe p-value and the expected best of M under no edge", () => {
    // Sharpe 1 over 4 years: t = 2, p = 1 − Φ(2) ≈ 0.0228.
    expect(sharpePValue(1, 4)).toBeCloseTo(1 - normalCdf(2), 10);
    expect(sharpePValue(1, 4)).toBeCloseTo(0.02275, 4);
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.95996, 4);
    expect(expectedBestSharpe(1, 3)).toBe(0);
    // 100 tries over 1 year: best ≈ Φ⁻¹(1 − 1/101) ≈ 2.33.
    expect(expectedBestSharpe(100, 1)).toBeCloseTo(2.33, 1);
    expect(expectedBestSharpe(100, 4)).toBeCloseTo(expectedBestSharpe(100, 1) / 2, 10);
  });
});

describe("course and MLM economics", () => {
  it("levels grow as r^n and run out of people", () => {
    expect(membersPerLevel(3, 3)).toEqual([1, 3, 9, 27]);
    // r = 10: levels 0..7 hold 11 111 111 < 37.4 M; with level 8 it's 111 111 111.
    expect(saturationLevel(10)).toBe(8);
    expect(saturationLevel(10, 11_111_111)).toBe(7);
    expect(saturationLevel(1)).toBeNull();
    expect(POLAND_POPULATION).toBe(37_400_000);
  });

  it("most members end up at the bottom with nobody recruited", () => {
    expect(bottomShare(10, 8)).toBeCloseTo(100_000_000 / 111_111_111, 10);
    expect(bottomShare(10, 8)).toBeCloseTo(0.9, 2);
    expect(bottomShare(2, 1)).toBeCloseTo(2 / 3);
  });

  it("recruits needed to earn back the price", () => {
    // 30% on direct recruits only: 1 / 0.3 → 4 recruits.
    expect(recruitsToBreakEven(1000, [0.3], 3)).toBe(4);
    // 30% + 10% on their 3 recruits each: a direct recruit is worth 0.3 + 0.3 = 0.6 → 2.
    expect(recruitsToBreakEven(1000, [0.3, 0.1], 3)).toBe(2);
    expect(recruitsToBreakEven(1000, [], 3)).toBeNull();
    expect(recruitsToBreakEven(0, [0.3], 3)).toBe(0);
  });
});

describe("indicator noise", () => {
  it("SMA, EMA and MACD on hand-computed numbers", () => {
    expect(sma([1, 2, 3, 4, 5], 3).slice(2)).toEqual([2, 3, 4]);
    expect(sma([1, 2, 3], 3).slice(0, 2).every(Number.isNaN)).toBe(true);
    // EMA(3): α = 0.5; 1 → 0.5·2 + 0.5·1 = 1.5 → 0.5·3 + 0.75 = 2.25.
    expect(ema([1, 2, 3], 3)).toEqual([1, 1.5, 2.25]);
    const flat = macd(Array.from({ length: 50 }, () => 100));
    expect(flat.line.every((v) => v === 0)).toBe(true);
  });

  it("RSI: 100 when it only rises, 0 when it only falls, 50 when gains equal losses", () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(up, 14)[14]).toBe(100);
    const down = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(down, 14)[14]).toBe(0);
    const zigzag = Array.from({ length: 15 }, (_, i) => (i % 2 === 0 ? 100 : 101));
    expect(rsi(zigzag, 14)[14]).toBeCloseTo(50);
    expect(rsiSignals([20, 35, 80, 65])).toEqual([
      { index: 1, side: "buy" },
      { index: 3, side: "sell" },
    ]);
  });

  it("crossings on a constructed series", () => {
    const a = [1, 2, 3, 2, 1, 2];
    const b = [2, 2, 2, 2, 2, 2];
    expect(crossings(a, b)).toEqual([
      { index: 2, side: "buy" },
      { index: 4, side: "sell" },
    ]);
    const prices = [100, 100, 110, 110, 90];
    expect(evaluate(prices, [{ index: 1, side: "buy" }], 1)).toEqual({
      signals: 1,
      hits: 1,
      meanReturn: 0.1,
    });
  });

  it("on random walks the signals are a coin flip", () => {
    for (const kind of ["ma", "rsi", "macd"] as const) {
      const r = noiseStudy(kind, 500, 250, 1600);
      expect(r.signals).toBeGreaterThan(500);
      expect(r.hitRate).toBeGreaterThan(0.47);
      expect(r.hitRate).toBeLessThan(0.53);
      expect(Math.abs(r.meanReturn)).toBeLessThan(0.005);
    }
  });
});
