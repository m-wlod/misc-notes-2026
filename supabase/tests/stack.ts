import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

import type { Database } from "../../src/lib/db/database.types";

type Status = { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string; DB_URL: string };

let cached: Status | undefined;

/** Connection details of the local stack (`supabase status`), or from env in CI. */
export function stack(): Status {
  if (cached) return cached;
  const fromEnv = {
    API_URL: process.env.SUPABASE_TEST_URL,
    PUBLISHABLE_KEY: process.env.SUPABASE_TEST_PUBLISHABLE_KEY,
    SECRET_KEY: process.env.SUPABASE_TEST_SECRET_KEY,
    DB_URL: process.env.SUPABASE_TEST_DB_URL,
  };
  if (fromEnv.API_URL && fromEnv.PUBLISHABLE_KEY && fromEnv.SECRET_KEY && fromEnv.DB_URL) {
    cached = fromEnv as Status;
  } else {
    const out = execSync("pnpm exec supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    cached = JSON.parse(out.slice(out.indexOf("{"))) as Status;
  }
  return cached;
}

export type Db = SupabaseClient<Database>;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export const admin = (): Db =>
  createClient<Database>(stack().API_URL, stack().SECRET_KEY, noSession);
export const anon = (): Db =>
  createClient<Database>(stack().API_URL, stack().PUBLISHABLE_KEY, noSession);
export const sql = () => postgres(stack().DB_URL, { max: 2, onnotice: () => undefined });

export type TestUser = { id: string; email: string; client: Db };

/** Creates a confirmed user and returns a client signed in as them. */
export async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function deleteUser(user: TestUser | undefined) {
  if (user) await admin().auth.admin.deleteUser(user.id);
}
