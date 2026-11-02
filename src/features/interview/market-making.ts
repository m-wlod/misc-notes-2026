import { mulberry32, normal } from "@/lib/math/rng";

/**
 * Market-making game (Phase 11). The learner quotes a bid and an ask on an unknown
 * quantity; a trader with a noisy view of the true value trades against them. Runs in
 * the browser, offline. The scenarios are game mechanics with exact distributions, not
 * course content.
 *
 * Score vs P&L: P&L depends on the draw (luck); the score depends only on the quote:
 * full marks for a tight quote around the expected value, less for a wide one, 0 when
 * the expected value lies outside it. That difference is the lesson.
 */
export type Distribution = readonly { value: number; p: number }[];

export const SCENARIO_IDS = ["three-dice", "ten-coins", "max-two-dice", "two-cards"] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** Exact distribution of a sum of independent discrete variables (convolution). */
function convolve(a: Distribution, b: Distribution): Distribution {
  const out = new Map<number, number>();
  for (const x of a)
    for (const y of b) out.set(x.value + y.value, (out.get(x.value + y.value) ?? 0) + x.p * y.p);
  return [...out.entries()].sort((x, y) => x[0] - y[0]).map(([value, p]) => ({ value, p }));
}

const die: Distribution = [1, 2, 3, 4, 5, 6].map((value) => ({ value, p: 1 / 6 }));
const coin: Distribution = [
  { value: 0, p: 0.5 },
  { value: 1, p: 0.5 },
];

function distributionOf(id: ScenarioId): Distribution {
  switch (id) {
    case "three-dice":
      return convolve(convolve(die, die), die);
    case "ten-coins": {
      let d: Distribution = coin;
      for (let i = 1; i < 10; i++) d = convolve(d, coin);
      return d;
    }
    case "max-two-dice":
      // P(max = k) = (2k − 1) / 36
      return [1, 2, 3, 4, 5, 6].map((k) => ({ value: k, p: (2 * k - 1) / 36 }));
    case "two-cards": {
      // Two cards without replacement from ten cards numbered 1–10: sum.
      const out = new Map<number, number>();
      for (let a = 1; a <= 10; a++)
        for (let b = 1; b <= 10; b++) if (a !== b) out.set(a + b, (out.get(a + b) ?? 0) + 1 / 90);
      return [...out.entries()].sort((x, y) => x[0] - y[0]).map(([value, p]) => ({ value, p }));
    }
  }
}

export const mean = (d: Distribution) => d.reduce((s, x) => s + x.value * x.p, 0);
export const sd = (d: Distribution) => {
  const m = mean(d);
  return Math.sqrt(d.reduce((s, x) => s + (x.value - m) ** 2 * x.p, 0));
};

export type Scenario = { id: ScenarioId; dist: Distribution; ev: number; sd: number };
export function scenario(id: ScenarioId): Scenario {
  const dist = distributionOf(id);
  return { id, dist, ev: mean(dist), sd: sd(dist) };
}

export type Round = {
  id: string;
  scenario: ScenarioId;
  /** The drawn true value (revealed after the quote). */
  value: number;
  /** The trader's private estimate: the true value plus noise. */
  traderView: number;
};

export const MARKET_MAKING = { rounds: 5, durationMs: 10 * 60_000 } as const;

/** The rounds for a session: scenarios, true values and the trader's views, all seeded. */
export function generateRounds(seed: number, count: number = MARKET_MAKING.rounds): Round[] {
  const rand = mulberry32(seed);
  const z = normal(rand);
  return Array.from({ length: count }, (_, i) => {
    const s = scenario(SCENARIO_IDS[Math.floor(rand() * SCENARIO_IDS.length)] as ScenarioId);
    let u = rand();
    let value = s.dist.at(-1)?.value ?? 0;
    for (const x of s.dist) {
      if (u < x.p) {
        value = x.value;
        break;
      }
      u -= x.p;
    }
    // The trader knows something: a view centred on the truth, half a standard deviation wide.
    const traderView = value + z() * s.sd * 0.5;
    return { id: `mk-${String(seed)}-${String(i)}`, scenario: s.id, value, traderView };
  });
}

export type QuoteResult =
  | { ok: false; reason: "invalid" | "crossed" }
  | {
      ok: true;
      /** "buy": the trader bought from you at your ask; "sell": sold to you at your bid. */
      trade: "buy" | "sell" | "none";
      pnl: number;
      ev: number;
      sd: number;
      width: number;
      evInside: boolean;
      /** 0–1, from the quote only (see the module comment). */
      score: number;
    };

export function settleQuote(round: Round, bid: number, ask: number): QuoteResult {
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return { ok: false, reason: "invalid" };
  if (bid >= ask) return { ok: false, reason: "crossed" };
  const s = scenario(round.scenario);
  const trade = round.traderView > ask ? "buy" : round.traderView < bid ? "sell" : "none";
  const pnl = trade === "buy" ? ask - round.value : trade === "sell" ? round.value - bid : 0;
  const width = ask - bid;
  const evInside = bid <= s.ev && s.ev <= ask;
  // Inside: 1 for a quote up to one sd wide, falling to 0.5 at four sd wide and beyond.
  const widthPenalty = Math.min(0.5, Math.max(0, (width - s.sd) / (6 * s.sd)));
  const score = evInside ? 1 - widthPenalty : 0;
  return {
    ok: true,
    trade,
    pnl: Math.round(pnl * 1e6) / 1e6,
    ev: s.ev,
    sd: s.sd,
    width,
    evInside,
    score: Math.round(score * 1e4) / 1e4,
  };
}
