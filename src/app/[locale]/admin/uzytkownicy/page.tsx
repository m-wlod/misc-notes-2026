import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import { requirePage } from "@/features/admin/server";
import { Link } from "@/i18n/navigation";

type Props = PageProps<"/[locale]/admin/uzytkownicy">;

/** User search (Phase 18, admins only): email, handle or id. */
export default function AdminUsersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: Pick<Props, "searchParams">) {
  await connection();
  const { session } = await requirePage("users");
  const t = await getTranslations("admin.users");
  const format = await getFormatter();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 120) ?? "";
  const { data } = await session.supabase.rpc("admin_find_users", { q });
  const users = data ?? [];
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "–";

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">{t("title")}</h1>
      <form role="search" className="flex flex-wrap items-end gap-2 font-sans text-sm">
        <label className="grid gap-1">
          {t("search")}
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={120}
            className="w-72 max-w-full rounded border border-rule-strong bg-surface px-2 py-1"
          />
        </label>
        <Button type="submit" size="sm" variant="secondary">
          {t("searchButton")}
        </Button>
      </form>
      {users.length === 0 ? (
        <p className="text-ink-muted">{t("noResults")}</p>
      ) : (
        <Table label={t("title")}>
          <thead>
            <tr>
              <Th>{t("email")}</Th>
              <Th>{t("handle")}</Th>
              <Th>{t("joined")}</Th>
              <Th>{t("lastSignIn")}</Th>
              <Th>{t("roles")}</Th>
              <Th>{t("banned")}</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-user={u.id}>
                <Td>
                  <Link href={{ pathname: "/admin/uzytkownicy/[id]", params: { id: u.id } }}>
                    {u.email}
                  </Link>
                </Td>
                <Td>{u.handle}</Td>
                <Td>{date(u.created_at)}</Td>
                <Td>{date(u.last_sign_in_at)}</Td>
                <Td>{u.roles || t("none")}</Td>
                <Td>{u.banned ? t("yes") : ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
