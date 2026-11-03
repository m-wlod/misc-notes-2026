/** The four claim checkers (Phase 16). Plain module: usable from server components too. */
export const CHECKER_IDS = ["ev", "luck", "mlm", "indicators"] as const;
export type CheckerId = (typeof CHECKER_IDS)[number];
