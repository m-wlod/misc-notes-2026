import { randomUUID } from "node:crypto";

import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/db/database.types";

/**
 * Test users for the signed-in suite (Phase 17c). Created with the secret key, signed
 * in with a password through @supabase/ssr itself, and the session cookies it writes
 * are copied into the browser context: the same cookies a real sign-in leaves.
 */
const url = () => required("NEXT_PUBLIC_SUPABASE_URL");
const publishable = () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set: run through pnpm test:e2e:db`);
  return v;
}

export const admin = () =>
  createClient<Database>(url(), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export type User = { id: string; email: string; password: string };

export async function createUser(
  label: string,
  role?: "moderator" | "admin" | "reviewer",
): Promise<User> {
  const email = `e2e-${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = `pw-${randomUUID()}`;
  const db = admin();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  // Onboarded, so no first-visit flows get in the way.
  await db.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", id);
  if (role) {
    const { error: roleError } = await db.from("user_roles").insert({ user_id: id, role });
    if (roleError) throw roleError;
  }
  return { id, email, password };
}

export async function deleteUsers(users: (User | undefined)[]) {
  const db = admin();
  const ids = users.flatMap((u) => (u ? [u.id] : []));
  // Their posts first (authors are anonymised, not deleted, on account deletion).
  await db.from("comments").delete().in("user_id", ids);
  await db.from("reports").delete().in("user_id", ids);
  for (const id of ids) await db.auth.admin.deleteUser(id);
}

export async function signIn(context: BrowserContext, user: User) {
  const jar = new Map<string, string>();
  const client = createServerClient<Database>(url(), publishable(), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const c of cookies) jar.set(c.name, c.value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  // @supabase/ssr may write the cookies just after the sign-in resolves.
  for (let i = 0; i < 20 && jar.size === 0; i++) await new Promise((r) => setTimeout(r, 25));
  if (jar.size === 0) throw new Error("sign-in wrote no session cookie");
  await context.clearCookies();
  await context.addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      sameSite: "Lax" as const,
    })),
  );
}
