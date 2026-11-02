import type { SessionKind } from "./session";

/**
 * The interview session types (Phase 11): URL slugs per language, length, and whether
 * the type is playable yet. 11a ships mental math and market making; 11b the
 * exercise-based ones.
 */
export type KindInfo = {
  kind: SessionKind;
  slug: { pl: string; en: string };
  /** Number of questions or rounds. */
  size: number;
  minutes: number;
  /** Works fully in the browser, offline, without AI. */
  offline: boolean;
  playable: boolean;
};

export const KINDS: readonly KindInfo[] = [
  {
    kind: "mental_math",
    slug: { pl: "matematyka-w-pamieci", en: "mental-math" },
    size: 80,
    minutes: 8,
    offline: true,
    playable: true,
  },
  {
    kind: "market_making",
    slug: { pl: "market-making", en: "market-making" },
    size: 5,
    minutes: 10,
    offline: true,
    playable: true,
  },
  {
    kind: "probability_sprint",
    slug: { pl: "sprint-prawdopodobienstwa", en: "probability-sprint" },
    size: 10,
    minutes: 20,
    offline: false,
    playable: false,
  },
  {
    kind: "brainteasers",
    slug: { pl: "lamiglowki", en: "brainteasers" },
    size: 3,
    minutes: 30,
    offline: false,
    playable: false,
  },
  {
    kind: "open_modelling",
    slug: { pl: "pytanie-otwarte", en: "open-modelling" },
    size: 1,
    minutes: 20,
    offline: false,
    playable: false,
  },
];

export function kindBySlug(slug: string): KindInfo | undefined {
  return KINDS.find((k) => k.slug.pl === slug || k.slug.en === slug);
}
export const kindInfo = (kind: SessionKind) => KINDS.find((k) => k.kind === kind) as KindInfo;
