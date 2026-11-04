/**
 * Phase 21: no secret in what the browser downloads. Scans the client build output
 * (`.next/static`) after `pnpm build` for:
 * - well-known secret formats (Supabase secret keys, the legacy service_role JWT claim,
 *   Anthropic keys, private keys);
 * - the names of server-only environment variables (a sign that server code was bundled);
 * - the actual values of any secret present in this environment (CI sets test values).
 *
 *   pnpm build && pnpm check:client-secrets
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { serverSchema } from "../src/env.schema";

const dist = process.env.NEXT_DIST_DIR ?? ".next";
const root = join(dist, "static");

const FORMATS: [string, RegExp][] = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{10,}/],
  ["service_role JWT", /"role"\s*:\s*"service_role"|c2VydmljZV9yb2xl/],
  ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{10,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

/** Server-only keys whose names must never appear in client code. */
const SERVER_KEYS = Object.keys(serverSchema).filter(
  (k) => !["NODE_ENV", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"].includes(k),
);

/** Values of secrets set in this environment, long enough not to match by chance. */
const VALUES = SERVER_KEYS.map((k) => [k, process.env[k]] as const).filter(
  (e): e is readonly [string, string] => typeof e[1] === "string" && e[1].length >= 16,
);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.(js|css|json|html|txt|map)$/.test(p)
        ? [p]
        : [];
  });
}

const problems: string[] = [];
const all = files(root);
for (const file of all) {
  const text = readFileSync(file, "utf8");
  for (const [what, re] of FORMATS) if (re.test(text)) problems.push(`${file}: ${what}`);
  for (const key of SERVER_KEYS) if (text.includes(key)) problems.push(`${file}: names ${key}`);
  for (const [key, value] of VALUES)
    if (text.includes(value)) problems.push(`${file}: value of ${key}`);
}

if (problems.length > 0) {
  console.error(
    `check:client-secrets: ${String(problems.length)} problem(s)\n  ${problems.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(
  `check:client-secrets ok: ${String(all.length)} client files, ${String(SERVER_KEYS.length)} server keys, ${String(VALUES.length)} secret value(s) checked`,
);
