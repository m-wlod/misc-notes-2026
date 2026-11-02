import { useTranslations } from "next-intl";

import { cx } from "@/lib/cx";

import { LEAGUE } from "../config";

/**
 * My league group this week (Phase 14), presentational. In split mode the promotion and
 * demotion zones are marked with a rule and a label (not colour alone).
 */
export type LeagueTableData = {
  tierName: string;
  mode: "shared" | "split";
  me: string;
  members: { userId: string; handle: string | null; weeklyXp: number; rank: number }[];
};

export function LeagueTable({ data }: { data: LeagueTableData }) {
  const t = useTranslations("gamification.league");
  const n = data.members.length;
  const up = data.mode === "split" ? Math.floor(n * LEAGUE.promoteShare) : 0;
  const down = data.mode === "split" ? Math.floor(n * LEAGUE.demoteShare) : 0;
  return (
    <div className="grid gap-3">
      <p className="font-sans text-sm text-ink-muted">
        {data.mode === "shared" ? t("shared", { n: LEAGUE.splitThreshold }) : t("split")}
      </p>
      <table className="w-full max-w-xl border-collapse font-sans text-sm" data-league-table="">
        <caption className="sr-only">{t("tier", { tier: data.tierName })}</caption>
        <thead>
          <tr className="border-b border-rule-strong text-left text-xs text-ink-muted">
            <th scope="col" className="w-16 py-2 font-medium">
              {t("rank")}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t("name")}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t("xp")}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.members.map((m, i) => {
            const isMe = m.userId === data.me;
            return (
              <tr
                key={m.userId}
                data-me={isMe ? "" : undefined}
                className={cx(
                  "border-b border-rule",
                  isMe && "bg-sunken font-semibold",
                  up > 0 && i === up - 1 && "border-b-2 border-b-correct",
                  down > 0 && i === n - down - 1 && "border-b-2 border-b-wrong",
                )}
              >
                <td className="py-2 num">{m.rank}</td>
                <td className="py-2">
                  {isMe ? t("you") : (m.handle ?? t("anonymous"))}
                  {up > 0 && i === up - 1 ? (
                    <span className="ml-2 text-xs font-normal text-ink-muted">
                      ↑ {t("promotion")}
                    </span>
                  ) : null}
                  {down > 0 && i === n - down ? (
                    <span className="ml-2 text-xs font-normal text-ink-muted">
                      ↓ {t("demotion")}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 text-right num">{m.weeklyXp}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
