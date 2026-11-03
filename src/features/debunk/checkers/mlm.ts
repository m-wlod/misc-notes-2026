/**
 * Course / MLM economics (Phase 16). If each member must bring r new members, level n
 * holds rⁿ people; the scheme runs out of people fast. Also: how many recruits it takes
 * to earn back the price from commissions.
 */

/** Poland's population, rounded (GUS, mid-2025 estimate). Shown with its source. */
export const POLAND_POPULATION = 37_400_000;

/** Members on each level 0..levels (level 0 = the founder). */
export function membersPerLevel(r: number, levels: number): number[] {
  return Array.from({ length: levels + 1 }, (_, n) => r ** n);
}

/** The first level at which the whole scheme (levels 0..n) needs more people than exist. */
export function saturationLevel(r: number, population: number = POLAND_POPULATION): number | null {
  if (r <= 1) return null; // never saturates if nobody needs to recruit more than one
  let total = 0;
  for (let n = 0; n < 200; n++) {
    total += r ** n;
    if (total >= population) return n;
  }
  return null;
}

/**
 * When the scheme stops (at its last full level), the share of all members who are on
 * the bottom level and so have recruited nobody: rⁿ / Σ rⁱ → (r − 1) / r.
 */
export function bottomShare(r: number, lastLevel: number): number {
  const levels = membersPerLevel(r, lastLevel);
  const total = levels.reduce((a, b) => a + b, 0);
  return (levels.at(-1) ?? 0) / total;
}

/**
 * Recruits needed to earn back the price, counting commissions down the tiers with the
 * same r at each level: direct recruits pay tiers[0], their recruits tiers[1], …
 * Returns the number of direct recruits (null if even a full tree can't pay it back).
 */
export function recruitsToBreakEven(
  price: number,
  tiers: readonly number[],
  r: number,
): number | null {
  if (price <= 0) return 0;
  // Each direct recruit, if they too bring r, … earns: Σ_l tiers[l] · r^l · price.
  const perDirect = tiers.reduce((s, c, l) => s + c * r ** l * price, 0);
  if (perDirect <= 0) return null;
  return Math.ceil(price / perDirect - 1e-9);
}
