/**
 * i18n key parity: every locale must have the same message files, the same keys, the
 * same ICU placeholders and no empty strings. Polish is the reference.
 *
 *   pnpm i18n:check            (runs in CI)
 *
 * Runs directly on Node 24 (built-in TypeScript type stripping), so it imports only
 * Node built-ins.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type Catalog = Record<string, unknown>; // namespace → nested messages
export type Catalogs = Record<string, Catalog>; // locale → catalog

/** Flattens nested messages to "ns.a.b" → string (non-strings are reported as such). */
export function flatten(obj: unknown, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
      } else {
        out.set(key, v);
      }
    }
  }
  return out;
}

/**
 * ICU argument names used by a message: `{count}`, `{count, plural, …}`, `{n, number}`.
 * Plural/select branch bodies like `one {# item}` are not arguments.
 */
export function placeholders(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === "'") {
      // ICU quoting: skip a quoted literal section
      const end = message.indexOf("'", i + 1);
      if (end > i) i = end;
      continue;
    }
    if (ch === "{") {
      depth++;
      // An argument starts right after "{" at even nesting (top level or inside a branch body).
      const m = /^\s*([A-Za-z_][\w]*)\s*(?=[,}])/.exec(message.slice(i + 1));
      if (m?.[1] && depth % 2 === 1) names.add(m[1]);
    } else if (ch === "}") {
      depth--;
    }
  }
  return [...names].sort();
}

export type Problem = { locale: string; key: string; message: string };

export function checkCatalogs(catalogs: Catalogs, reference: string): Problem[] {
  const problems: Problem[] = [];
  const ref = catalogs[reference];
  if (!ref) return [{ locale: reference, key: "*", message: "reference locale missing" }];
  const refFlat = flatten(ref);

  for (const [locale, catalog] of Object.entries(catalogs)) {
    const flat = flatten(catalog);
    for (const [key, value] of flat) {
      if (typeof value !== "string") {
        problems.push({ locale, key, message: `value is ${typeof value}, expected a string` });
      } else if (value.trim() === "") {
        problems.push({ locale, key, message: "empty string" });
      }
    }
    if (locale === reference) continue;

    for (const ns of Object.keys(ref)) {
      if (!(ns in catalog)) problems.push({ locale, key: ns, message: `missing file ${ns}.json` });
    }
    for (const ns of Object.keys(catalog)) {
      if (!(ns in ref))
        problems.push({ locale, key: ns, message: `extra file ${ns}.json (not in ${reference})` });
    }
    for (const [key, refValue] of refFlat) {
      const value = flat.get(key);
      if (value === undefined) {
        problems.push({ locale, key, message: "missing key" });
      } else if (typeof value === "string" && typeof refValue === "string") {
        const a = placeholders(refValue).join(",");
        const b = placeholders(value).join(",");
        if (a !== b)
          problems.push({
            locale,
            key,
            message: `placeholders {${b}} differ from ${reference} {${a}}`,
          });
      }
    }
    for (const key of flat.keys()) {
      if (!refFlat.has(key))
        problems.push({ locale, key, message: `extra key (not in ${reference})` });
    }
  }
  return problems;
}

export function loadCatalogs(dir: string): Catalogs {
  const catalogs: Catalogs = {};
  for (const locale of readdirSync(dir, { withFileTypes: true })) {
    if (!locale.isDirectory()) continue;
    const catalog: Catalog = {};
    for (const file of readdirSync(join(dir, locale.name))) {
      if (!file.endsWith(".json")) continue;
      catalog[file.slice(0, -5)] = JSON.parse(
        readFileSync(join(dir, locale.name, file), "utf8"),
      ) as unknown;
    }
    catalogs[locale.name] = catalog;
  }
  return catalogs;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  const dir = resolve(process.argv[2] ?? "messages");
  const catalogs = loadCatalogs(dir);
  const problems = checkCatalogs(catalogs, "pl");
  if (problems.length > 0) {
    for (const p of problems) console.error(`✖ [${p.locale}] ${p.key}: ${p.message}`);
    console.error(`\n${String(problems.length)} i18n problem(s) in ${dir}`);
    process.exit(1);
  }
  const keys = flatten(catalogs.pl).size;
  console.log(`✓ i18n: ${Object.keys(catalogs).join(", ")} in sync (${String(keys)} keys each)`);
}
