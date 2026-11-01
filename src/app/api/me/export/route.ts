import { NextResponse } from "next/server";

import { exportMyData } from "@/lib/db/profile";
import { getSession } from "@/lib/db/session";

/**
 * RODO/GDPR art. 20: download everything stored about the signed-in user as JSON.
 * export_my_data() runs with the user's rights, so RLS limits it to their own rows.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await exportMyData();
  if (data === null) return NextResponse.json({ error: "export failed" }, { status: 500 });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="moje-dane-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
