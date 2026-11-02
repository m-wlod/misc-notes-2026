import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { resolveSiteUrl } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { certificatePdf } from "@/features/certificates/pdf";
import { verifyCertificate } from "@/features/certificates/server";

import { curriculum } from "../../../../../../content/curriculum";

/**
 * A certificate as PDF (Phase 15). Public like the verification page: it shows only
 * what `verify_certificate()` shows (name, track, date), never anything else.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/certificates/[id]/pdf">) {
  const { id } = await ctx.params;
  const lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "pl";
  const cert = await verifyCertificate(id);
  if (!cert) return new Response("not found", { status: 404 });
  const t = await getTranslations({ locale: lang, namespace: "certificates" });
  const track = curriculum.find((c) => c.id === cert.trackId);
  const verifyUrl = new URL(`/${lang}/verify/${id}`, resolveSiteUrl(env)).toString();
  const pdf = await certificatePdf({
    heading: t("pdf.heading"),
    name: cert.name,
    completed: t("pdf.completed"),
    track: track?.name[lang] ?? cert.trackId,
    date: new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pl-PL", {
      dateStyle: "long",
      timeZone: "Europe/Warsaw",
    }).format(new Date(cert.issuedAt)),
    verifyLabel: t("pdf.verify"),
    verifyUrl,
    disclaimer: t("disclaimer"),
    site: siteConfig.name,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certyfikat-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
