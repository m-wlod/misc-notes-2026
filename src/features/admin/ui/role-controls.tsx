"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { setRole, type AdminResult } from "../actions";

const ROLES = ["admin", "moderator", "reviewer"] as const;

/** Grant or revoke each role for one user (Phase 18, admins only, audited). */
export function RoleControls({ userId, roles }: { userId: string; roles: string[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  return (
    <div className="grid gap-2">
      <ul className="flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const has = roles.includes(role);
          const name = t(`roles.${role}`);
          return (
            <li key={role}>
              <Button
                size="sm"
                variant={has ? "secondary" : "primary"}
                disabled={pending}
                data-role={role}
                data-has={has ? "" : undefined}
                onClick={() => {
                  startTransition(async () => {
                    const r = await setRole({ userId, role, grant: !has });
                    setResult(r);
                    if (r.ok) router.refresh();
                  });
                }}
              >
                {has ? t("users.revoke", { role: name }) : t("users.grant", { role: name })}
              </Button>
            </li>
          );
        })}
      </ul>
      <p role="status" className="font-sans text-xs empty:hidden">
        {result === null
          ? ""
          : result.ok
            ? t("users.done")
            : result.reason === "self"
              ? t("users.self")
              : t("users.failed")}
      </p>
    </div>
  );
}
