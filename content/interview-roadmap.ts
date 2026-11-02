/**
 * Interview prep roadmap (Phase 11): what quant interviews typically test, as an outline
 * linked to curriculum tracks, interview sessions and practice sets. STUB: the topic list
 * is a starting structure; the descriptions are written in the separate content task
 * (docs/PROGRESS.md). **[you]** review the list together with content/curriculum.ts.
 */
import type { SessionKind } from "../src/features/interview/session";

export type RoadmapTopic = {
  id: string;
  name: { pl: string; en: string };
  /** Curriculum track ids (content/curriculum.ts). */
  tracks: string[];
  /** Interview sessions that train it. */
  sessions: SessionKind[];
  /** Filled in by the content task; until then the page says it's coming. */
  description?: { pl: string; en: string };
};

export const interviewRoadmap: RoadmapTopic[] = [
  {
    id: "mental-arithmetic",
    name: { pl: "Liczenie w pamięci", en: "Mental arithmetic" },
    tracks: ["foundations"],
    sessions: ["mental_math"],
  },
  {
    id: "probability",
    name: { pl: "Prawdopodobieństwo i kombinatoryka", en: "Probability and combinatorics" },
    tracks: ["probability"],
    sessions: ["probability_sprint"],
  },
  {
    id: "expected-value",
    name: { pl: "Wartość oczekiwana i zakłady", en: "Expected value and betting" },
    tracks: ["expected-value"],
    sessions: ["market_making", "probability_sprint"],
  },
  {
    id: "statistics",
    name: { pl: "Statystyka i testowanie hipotez", en: "Statistics and hypothesis testing" },
    tracks: ["statistics"],
    sessions: ["open_modelling"],
  },
  {
    id: "linear-algebra",
    name: { pl: "Algebra liniowa", en: "Linear algebra" },
    tracks: ["linear-algebra"],
    sessions: [],
  },
  {
    id: "stochastic",
    name: { pl: "Procesy losowe", en: "Random processes" },
    tracks: ["random-walks", "stochastic-calculus"],
    sessions: [],
  },
  {
    id: "markets",
    name: { pl: "Rynki, opcje i mikrostruktura", en: "Markets, options and microstructure" },
    tracks: ["options", "microstructure"],
    sessions: ["market_making"],
  },
  {
    id: "brainteasers",
    name: { pl: "Łamigłówki", en: "Brainteasers" },
    tracks: ["puzzles"],
    sessions: ["brainteasers"],
  },
];
