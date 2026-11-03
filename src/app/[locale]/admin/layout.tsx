import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { canAccess, NAV } from "@/features/admin/access";
import { rolesOf } from "@/features/admin/server";
import { AdminNav } from "@/features/admin/ui/nav";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * The admin panel shell (Phase 18). Who may open a page is decided by the proxy (403)
 * and again by each page; this only shows the sections the viewer's roles open.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <Suspense fallback={<div />}>
        <Nav />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function Nav() {
  await connection();
  if (!isSupabaseConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const roles = await rolesOf(session);
  return <AdminNav sections={NAV.filter((s) => canAccess(roles, s))} />;
}
