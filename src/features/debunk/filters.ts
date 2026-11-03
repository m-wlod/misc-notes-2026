/** Index filters from the URL (Phase 16): unknown values are ignored, never echoed. */
export function parseDebunkFilters<C extends string, V extends string>(
  search: Record<string, string | string[] | undefined>,
  categories: readonly C[],
  verdicts: readonly V[],
): { category?: C; verdict?: V } {
  const one = (k: string) => {
    const v = search[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const c = one("kategoria");
  const v = one("werdykt");
  return {
    ...(c && (categories as readonly string[]).includes(c) ? { category: c as C } : {}),
    ...(v && (verdicts as readonly string[]).includes(v) ? { verdict: v as V } : {}),
  };
}

export function applyDebunkFilters<T extends { category: string; verdict: string }>(
  entries: readonly T[],
  f: { category?: string; verdict?: string },
): T[] {
  return entries.filter(
    (e) => (!f.category || e.category === f.category) && (!f.verdict || e.verdict === f.verdict),
  );
}
