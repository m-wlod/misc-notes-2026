/**
 * Copy check (Phase 20c): no placeholder text, emoji or generic marketing phrases in the
 * UI messages, in either language (CLAUDE.md, "AI slop list"). Runs with i18n:check.
 *
 * Runs directly on Node 24 (built-in TypeScript type stripping): Node built-ins only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** "ns.a.b" → value, for every leaf of a messages file. */
function flatten(obj: unknown, prefix: string, out = new Map<string, unknown>()) {
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, `${prefix}.${k}`, out);
  } else {
    out.set(prefix, obj);
  }
  return out;
}

// "TODO(verify)" is the name of the content-check marker, shown as such in the admin.
const PLACEHOLDERS = /\bTODO\b(?!\(verify\))|\b(FIXME|TBD|XXX)\b|lorem ipsum|\?\?\?/i;

/** Phrases that sell instead of explain (both languages; matched case-insensitively). */
const BANNED = [
  "unlock your",
  "your potential",
  "odblokuj",
  "swój potencjał",
  "revolution",
  "rewolucyj",
  "game-changer",
  "game changer",
  "seamless",
  "cutting-edge",
  "world-class",
  "supercharge",
  "level up",
  "transform your",
  "join thousands",
  "dołącz do tysięcy",
  "tysiące zadowolonych",
  "thousands of happy",
  "best on the market",
  "najlepszy na rynku",
  "najlepsza na rynku",
  "guaranteed profit",
  "gwarantowany zysk",
  "skyrocket",
  "effortless",
  "bez wysiłku",
];

/** Emoji. The daily-result grid (🟩🟥) is built in code, not in messages. */
const EMOJI = /\p{Extended_Pictographic}/u;

const root = "messages";
const problems: string[] = [];
for (const locale of readdirSync(root)) {
  for (const file of readdirSync(join(root, locale))) {
    const ns = file.replace(/\.json$/, "");
    const json = JSON.parse(readFileSync(join(root, locale, file), "utf8")) as unknown;
    for (const [key, value] of flatten(json, ns)) {
      if (typeof value !== "string") continue;
      const where = `${locale}:${key}`;
      if (PLACEHOLDERS.test(value)) problems.push(`${where}: placeholder text "${value}"`);
      if (EMOJI.test(value)) problems.push(`${where}: emoji in "${value}"`);
      const lower = value.toLowerCase();
      for (const phrase of BANNED) {
        if (lower.includes(phrase)) problems.push(`${where}: "${phrase}" in "${value}"`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`copy: ${String(problems.length)} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("✓ copy: no placeholders, emoji or marketing phrases in the messages");
