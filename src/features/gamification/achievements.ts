/**
 * Achievements (Phase 14): the catalog and its rules over a snapshot of facts the
 * server knows about a learner. Names and descriptions are in messages
 * (`gamification.achievements.<id>`); the catalog migration is generated from both.
 * `client: true` ones are claimed by the browser (e.g. running a simulation): they are
 * cheap to fake, so they never give XP.
 */
export type Facts = {
  totalXp: number;
  streakLongest: number;
  freezesUsed: number;
  repairs: number;
  perfectWeeks: number;
  solved: number;
  firstTry: number;
  noHint: number;
  maxSolvedLevel: number;
  solvedTypes: readonly string[];
  lessonsCompleted: number;
  modulesCompleted: number;
  interviewKinds: readonly string[];
  mentalMathPersonalBest: boolean;
  marketMakingProfit: boolean;
  promotions: number;
  bestRank: number | null;
  maxTier: number;
  maxRating: number;
  kellyFirstTry: boolean;
  debunkFinished: number;
  /** Browser-claimed achievement ids. */
  claims: readonly string[];
};

export const EMPTY_FACTS: Facts = {
  totalXp: 0,
  streakLongest: 0,
  freezesUsed: 0,
  repairs: 0,
  perfectWeeks: 0,
  solved: 0,
  firstTry: 0,
  noHint: 0,
  maxSolvedLevel: 0,
  solvedTypes: [],
  lessonsCompleted: 0,
  modulesCompleted: 0,
  interviewKinds: [],
  mentalMathPersonalBest: false,
  marketMakingProfit: false,
  promotions: 0,
  bestRank: null,
  maxTier: 1,
  maxRating: 0,
  kellyFirstTry: false,
  debunkFinished: 0,
  claims: [],
};

/** Exercise types that count for "one of each" (open answers are self-checked: excluded). */
export const AUTO_GRADED_TYPES = [
  "numeric",
  "estimation",
  "interactive",
  "symbolic",
  "choice",
  "multi",
  "ordering",
  "code",
] as const;
export const INTERVIEW_KINDS = [
  "mental_math",
  "market_making",
  "probability_sprint",
  "brainteasers",
  "open_modelling",
] as const;

export type Achievement = {
  id: string;
  rule: (f: Facts) => boolean;
  client?: boolean;
};

const claimed = (id: string) => (f: Facts) => f.claims.includes(id);

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "pierwszy-krok", rule: (f) => f.solved >= 1 },
  { id: "dziesiatka", rule: (f) => f.solved >= 10 },
  { id: "pol-setki", rule: (f) => f.solved >= 50 },
  { id: "setka", rule: (f) => f.solved >= 100 },
  { id: "piecset", rule: (f) => f.solved >= 500 },
  { id: "za-pierwszym-razem", rule: (f) => f.firstTry >= 10 },
  { id: "bez-podpowiedzi", rule: (f) => f.noHint >= 25 },
  { id: "poziom-piaty", rule: (f) => f.maxSolvedLevel >= 5 },
  { id: "wszystkie-typy", rule: (f) => AUTO_GRADED_TYPES.every((t) => f.solvedTypes.includes(t)) },
  { id: "xp-100", rule: (f) => f.totalXp >= 100 },
  { id: "xp-1000", rule: (f) => f.totalXp >= 1000 },
  { id: "xp-10000", rule: (f) => f.totalXp >= 10_000 },
  { id: "seria-3", rule: (f) => f.streakLongest >= 3 },
  { id: "seria-7", rule: (f) => f.streakLongest >= 7 },
  { id: "seria-30", rule: (f) => f.streakLongest >= 30 },
  { id: "seria-100", rule: (f) => f.streakLongest >= 100 },
  { id: "seria-365", rule: (f) => f.streakLongest >= 365 },
  { id: "zamrozenie", rule: (f) => f.freezesUsed >= 1 },
  { id: "naprawa", rule: (f) => f.repairs >= 1 },
  { id: "idealny-tydzien", rule: (f) => f.perfectWeeks >= 1 },
  { id: "pierwsza-lekcja", rule: (f) => f.lessonsCompleted >= 1 },
  { id: "dziesiec-lekcji", rule: (f) => f.lessonsCompleted >= 10 },
  { id: "caly-modul", rule: (f) => f.modulesCompleted >= 1 },
  { id: "rozmowa", rule: (f) => f.interviewKinds.length >= 1 },
  {
    id: "wszystkie-rozmowy",
    rule: (f) => INTERVIEW_KINDS.every((k) => f.interviewKinds.includes(k)),
  },
  { id: "szybkie-liczenie", rule: (f) => f.mentalMathPersonalBest },
  { id: "animator-rynku", rule: (f) => f.marketMakingProfit },
  { id: "awans", rule: (f) => f.promotions >= 1 },
  { id: "podium", rule: (f) => f.bestRank !== null && f.bestRank <= 3 },
  { id: "ito", rule: (f) => f.maxTier >= 5 },
  { id: "black-scholes", rule: (f) => f.maxTier >= 6 },
  { id: "ekspert", rule: (f) => f.maxRating >= 1400 },
  { id: "kelly", rule: (f) => f.kellyFirstTry },
  { id: "anty-guru", rule: (f) => f.debunkFinished >= 10 },
  { id: "ruina-gracza", rule: claimed("ruina-gracza"), client: true },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Achievements the facts satisfy that the learner doesn't have yet. */
export function newAchievements(facts: Facts, owned: ReadonlySet<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !owned.has(a.id) && a.rule(facts)).map((a) => a.id);
}
