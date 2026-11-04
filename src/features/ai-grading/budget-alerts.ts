import { thresholdsCrossed } from "@/features/alerts/rules";
import type { Alert } from "@/features/alerts/send";

/**
 * AI budget alerts (Phase 22a): after a model call, an alert for each of 50%, 80% and
 * 100% of the day's budget that this call's cost crossed. `spentAfter` is the day's
 * spend from the usage log (shared by every instance), cost included.
 */
export async function alertBudget(
  spentAfter: number | null,
  costUsd: number,
  budgetUsd: number,
  send: (a: Alert) => Promise<unknown>,
): Promise<number[]> {
  if (spentAfter === null) return [];
  const crossed = thresholdsCrossed(spentAfter - costUsd, spentAfter, budgetUsd);
  for (const t of crossed) {
    await send({
      key: `ai-budget-${String(t)}`,
      subject: `AI grading budget at ${String(t)}%`,
      text: `AI grading has spent ${spentAfter.toFixed(2)} of today's ${budgetUsd.toFixed(2)} USD budget (${String(t)}%). ${t >= 100 ? "Grading is off until midnight UTC." : "It switches off at 100%."}`,
    });
  }
  return crossed;
}
