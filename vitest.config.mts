import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** The logic a bug in would cost learners points, streaks or money (Phase 20). */
const CRITICAL = [
  "src/features/exercises/grade.ts",
  "src/features/exercises/rate-limit.ts",
  "src/features/grading/*.ts",
  "src/features/ai-grading/quota.ts",
  ...["xp", "streak", "league", "rating", "days", "daily"].map(
    (f) => `src/features/gamification/${f}.ts`,
  ),
  ...["session", "mental-math", "market-making"].map((f) => `src/features/interview/${f}.ts`),
  "src/features/review/schedule.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Pure logic runs in node (fast). Component tests opt into the DOM per file with
    // a `// @vitest-environment jsdom` docblock. Tests import describe/it/expect from vitest.
    environment: "node",
    globals: false,
    // Phase 20: `pnpm test:coverage` measures the critical logic (graders, XP, streaks,
    // leagues, ratings, quotas and limits, interview scoring, review scheduling) and fails
    // below 90% overall, or below the per-file floor. UI and server glue are covered by e2e.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: CRITICAL,
      exclude: ["**/*.test.ts"],
      // Every file on its own. Branches have a lower floor: v8 counts each `??` fallback
      // for an impossible case (an index inside a non-empty list) as an untaken branch.
      thresholds: { perFile: true, statements: 90, functions: 90, lines: 90, branches: 75 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          // Coverage instrumentation slows the heaviest loops (1000-attempt storage tests).
          testTimeout: 20_000,
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
        },
      },
      {
        // Needs the local Supabase stack: `pnpm db:start && pnpm test:db`.
        extends: true,
        test: {
          name: "db",
          include: ["supabase/tests/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
