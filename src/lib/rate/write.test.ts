import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Phase 21: every server action ("use server" export = a public endpoint) is rate
 * limited, or listed below with the reason it needs no limit. A new action without
 * either fails here.
 */
const LIMITED = [
  "allowWrite(",
  "exerciseLimiter.hit(",
  "limiter.hit(",
  "rateOk(", // community posts: counted in the database
  "checkQuota(", // AI grading: its own daily quotas
];

/** Actions that need no limit, and why. */
const EXEMPT: Record<string, string> = {
  // Staff only: the role is checked first (staffFor) and every change is audited.
  setPostStatus: "staff",
  setMentorPick: "staff",
  resolveReport: "staff",
  banUser: "staff",
  unbanUser: "staff",
  resolveCorrection: "staff",
  resolveItem: "staff",
  saveAiSettings: "staff",
  saveFlag: "staff",
  deleteFlag: "staff",
  createAnnouncement: "staff",
  closeAnnouncement: "staff",
  resolveDispute: "staff",
  setRole: "staff",
  // Ends the caller's own session; writes nothing.
  signOut: "no write",
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [p] : [];
  });
}

const actions = files("src")
  .map((path) => ({ path, src: readFileSync(path, "utf8") }))
  .filter(({ src }) => /^\s*["']use server["'];/.test(src))
  .flatMap(({ path, src }) =>
    [...src.matchAll(/export async function (\w+)\(/g)].map((m) => {
      const start = m.index;
      const next = src.indexOf("\nexport ", start + 1);
      return { path, name: m[1] ?? "", body: src.slice(start, next === -1 ? undefined : next) };
    }),
  );

describe("server actions", () => {
  it("are found (the scan works)", () => {
    expect(actions.length).toBeGreaterThan(40);
  });

  it("are all rate limited, or exempt with a reason", () => {
    const missing = actions
      .filter((a) => !(a.name in EXEMPT))
      .filter((a) => !LIMITED.some((call) => a.body.includes(call)))
      .map((a) => `${a.path} ${a.name}`);
    expect(missing).toEqual([]);
  });

  it("staff exemptions really check the role first", () => {
    const staff = actions.filter((a) => EXEMPT[a.name] === "staff");
    expect(staff.filter((a) => !/staffFor\(|staff\(\)/.test(a.body)).map((a) => a.name)).toEqual(
      [],
    );
  });
});
