import { coinWalk } from "./defs/coin-walk";
import { gbm } from "./defs/gbm";
import { llnClt } from "./defs/lln-clt";
import { monteCarlo } from "./defs/monte-carlo";
import type { SimDef } from "./types";

/**
 * Every simulation, in the order the Lab lists them (Phase 12). Pure definitions: the
 * worker imports this too, so nothing here touches the DOM at import time.
 */
export const SIMS: readonly SimDef[] = [coinWalk, llnClt, gbm, monteCarlo];

export const SIM_IDS = SIMS.map((s) => s.id);
export const simById = (id: string) => SIMS.find((s) => s.id === id);
export const simBySlug = (slug: string) =>
  SIMS.find((s) => s.slug.pl === slug || s.slug.en === slug);
