import { readFile } from "node:fs/promises";
import { join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

import { woffToSfnt } from "./woff";

/**
 * The certificate as a one-page A4 landscape PDF (Phase 15), in the site's type (IBM
 * Plex, Polish diacritics included). Plain and honest: who, which track, when, how to
 * verify it, and that it records completing a course, not a qualification.
 */
export type CertificateText = {
  heading: string;
  name: string;
  completed: string;
  track: string;
  date: string;
  verifyLabel: string;
  verifyUrl: string;
  disclaimer: string;
  site: string;
};

/** Our .woff fonts as sfnt, which fontkit reads (see woff.ts). */
const font = async (file: string) =>
  woffToSfnt(await readFile(join(process.cwd(), "assets/fonts", file)));
const INK = rgb(0x1b / 255, 0x22 / 255, 0x30 / 255);
const MUTED = rgb(0x5d / 255, 0x64 / 255, 0x72 / 255);
const ACCENT = rgb(0xb4 / 255, 0x44 / 255, 0x0e / 255);
const PAPER = rgb(0xf6 / 255, 0xf1 / 255, 0xe7 / 255);

/**
 * pdf-lib embeds one font file per face; the Polish letters live in Plex's latin-ext
 * subset, so each run of text uses the subset that has its glyphs.
 */
export async function certificatePdf(text: CertificateText): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${text.heading}: ${text.track}`);
  doc.setCreator(text.site);
  const [regular, regularExt, bold, boldExt] = await Promise.all([
    font("ibm-plex-sans-latin-400-normal.woff"),
    font("ibm-plex-sans-latin-ext-400-normal.woff"),
    font("ibm-plex-sans-latin-600-normal.woff"),
    font("ibm-plex-sans-latin-ext-600-normal.woff"),
  ]);
  const faces: Record<"regular" | "bold", readonly [PDFFont, PDFFont]> = {
    regular: [await doc.embedFont(regular), await doc.embedFont(regularExt)],
    bold: [await doc.embedFont(bold), await doc.embedFont(boldExt)],
  };

  const charsets = new Map(
    [faces.regular[0], faces.bold[0]].map((f) => [f, new Set(f.getCharacterSet())]),
  );

  const page = doc.addPage([842, 595]); // A4 landscape, points
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: INK,
    borderWidth: 1,
  });

  /** Draws a line, switching to the latin-ext face for characters latin lacks. */
  const line = (s: string, y: number, size: number, weight: "regular" | "bold", color = INK) => {
    const [basic, ext] = faces[weight];
    const has = charsets.get(basic) ?? new Set<number>();
    const runs: { text: string; f: PDFFont }[] = [];
    for (const ch of s) {
      const f = has.has(ch.codePointAt(0) ?? 0) ? basic : ext;
      const last = runs.at(-1);
      if (last?.f === f) last.text += ch;
      else runs.push({ text: ch, f });
    }
    const total = runs.reduce((w, r) => w + r.f.widthOfTextAtSize(r.text, size), 0);
    let x = (width - total) / 2;
    for (const r of runs) {
      page.drawText(r.text, { x, y, size, font: r.f, color });
      x += r.f.widthOfTextAtSize(r.text, size);
    }
  };

  line(text.heading.toUpperCase(), height - 120, 14, "bold", ACCENT);
  line(text.name, height - 200, 34, "bold");
  line(text.completed, height - 245, 16, "regular", MUTED);
  line(text.track, height - 290, 26, "bold");
  line(text.date, height - 330, 14, "regular", MUTED);
  line(`${text.verifyLabel}: ${text.verifyUrl}`, 120, 11, "regular", MUTED);
  line(text.disclaimer, 96, 10, "regular", MUTED);
  line(text.site, 64, 10, "bold");
  return doc.save();
}
