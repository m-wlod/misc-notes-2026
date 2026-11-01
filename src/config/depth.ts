/**
 * Lesson depth: "easy" (Po ludzku) or "formal" (Podręcznik). Both versions are in the
 * HTML; CSS shows one based on `data-depth` on <html>, set before first paint by
 * DEPTH_SCRIPT, so static pages need no client render to switch.
 * TODO(accounts): also store the choice on the profile once Supabase is enabled.
 */
export const DEPTH_STORAGE_KEY = "qla:depth";
export const DEPTHS = ["easy", "formal"] as const;
export type Depth = (typeof DEPTHS)[number];
export const DEFAULT_DEPTH: Depth = "easy";

export function pickDepth(stored: string | null | undefined): Depth {
  return DEPTHS.find((d) => d === stored) ?? DEFAULT_DEPTH;
}

/** Inline, before first paint. Mirrors pickDepth; storage can throw in private mode. */
export const DEPTH_SCRIPT = `try{var d=localStorage.getItem(${JSON.stringify(DEPTH_STORAGE_KEY)});document.documentElement.dataset.depth=d==="formal"?"formal":"easy"}catch(e){document.documentElement.dataset.depth="easy"}`;
