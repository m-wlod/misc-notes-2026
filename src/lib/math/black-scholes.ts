import { normalCdf, normalPdf } from "./stats";

/**
 * Black–Scholes for European options on a non-dividend stock (Phase 12). Inputs: spot S,
 * strike K, volatility σ (per year), time T (years), risk-free rate r (continuous).
 */
export type BsInput = { S: number; K: number; sigma: number; T: number; r: number };
export type OptionType = "call" | "put";

function d1d2({ S, K, sigma, T, r }: BsInput) {
  const v = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / v;
  return { d1, d2: d1 - v };
}

export function bsPrice(type: OptionType, input: BsInput): number {
  const { S, K, T, r } = input;
  if (T <= 0 || input.sigma <= 0) {
    const intrinsic =
      type === "call"
        ? S - K * Math.exp(-r * Math.max(T, 0))
        : K * Math.exp(-r * Math.max(T, 0)) - S;
    return Math.max(0, intrinsic);
  }
  const { d1, d2 } = d1d2(input);
  return type === "call"
    ? S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2)
    : K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1);
}

/** Delta, gamma, vega (per 1.00 of σ), theta (per year), rho (per 1.00 of r). */
export function bsGreeks(type: OptionType, input: BsInput) {
  const { S, K, sigma, T, r } = input;
  const { d1, d2 } = d1d2(input);
  const disc = Math.exp(-r * T);
  const pdf = normalPdf(d1);
  const gamma = pdf / (S * sigma * Math.sqrt(T));
  const vega = S * pdf * Math.sqrt(T);
  if (type === "call") {
    return {
      delta: normalCdf(d1),
      gamma,
      vega,
      theta: (-S * pdf * sigma) / (2 * Math.sqrt(T)) - r * K * disc * normalCdf(d2),
      rho: K * T * disc * normalCdf(d2),
    };
  }
  return {
    delta: normalCdf(d1) - 1,
    gamma,
    vega,
    theta: (-S * pdf * sigma) / (2 * Math.sqrt(T)) + r * K * disc * normalCdf(-d2),
    rho: -K * T * disc * normalCdf(-d2),
  };
}
