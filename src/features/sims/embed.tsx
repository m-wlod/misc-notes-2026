"use client";

import dynamic from "next/dynamic";

import { DEFAULT_SEED, defaults } from "./params";
import { simById } from "./registry";

const Player = dynamic(() => import("./player").then((m) => m.SimPlayer), { ssr: false });

/**
 * `<Simulation id="…" />` in lesson MDX (Phase 12): the player with default parameters
 * and fewer controls, loaded only on lessons that use one.
 */
export function Simulation({ id }: { id: string }) {
  const def = simById(id);
  if (!def) return null;
  return (
    <Player
      id={id}
      initial={{ params: defaults(def.params), seed: DEFAULT_SEED, t: null }}
      syncUrl={false}
      compact
    />
  );
}
