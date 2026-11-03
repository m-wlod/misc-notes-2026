import { NextResponse } from "next/server";

import { audit, requireApi } from "@/features/admin/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A user's data export for admins (Phase 18; RODO requests that arrive by email).
 * Same JSON as /api/me/export, built by `admin_export_user()` (admins only, in SQL too)
 * and recorded in the audit log. Everyone else gets 403.
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/admin/users/[id]/export">) {
  const staff = await requireApi("users");
  if (staff instanceof Response) return staff;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data, error } = await staff.session.supabase.rpc("admin_export_user", { target: id });
  if (error || data === null) return NextResponse.json({ error: "export failed" }, { status: 500 });
  await audit(staff.admin, staff.actor, "user.export", `user:${id}`);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dane-${id}-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
