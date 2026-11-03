import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { requirePage } from "@/features/admin/server";
import { RoleControls } from "@/features/admin/ui/role-controls";
import { BanForm, UnbanButton } from "@/features/community/ui/admin-actions";
import { Link } from "@/i18n/navigation";

type Props = PageProps<"/[locale]/admin/uzytkownicy/[id]">;

export function generateStaticParams() {
  return [{ id: "00000000-0000-0000-0000-000000000000" }];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One user (Phase 18, admins only): roles, ban, activity, data export. */
export default function AdminUserPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <User params={params} />
    </Suspense>
  );
}

async function User({ params }: Pick<Props, "params">) {
  await connection();
  const { session, admin } = await requirePage("users");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data } = await session.supabase.rpc("admin_find_users", { q: id });
  const user = data?.find((u) => u.id === id);
  if (!user) notFound();
  const t = await getTranslations("admin.users");
  const tc = await getTranslations("community.profile");
  const format = await getFormatter();
  const [streak, last] = await Promise.all([
    admin.from("streaks").select("current_days, longest_days").eq("user_id", id).maybeSingle(),
    admin
      .from("exercise_attempts")
      .select("created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const date = (iso: string | null | undefined) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : "–";
  const roles = user.roles ? user.roles.split(",") : [];

  return (
    <div className="grid gap-8" data-admin-user={id}>
      <p className="font-sans text-sm">
        <Link href="/admin/uzytkownicy">{t("back")}</Link>
      </p>
      <header className="grid gap-1">
        <h1 className="text-3xl break-all">{user.email}</h1>
        <p className="font-sans text-sm text-ink-muted">
          @{user.handle} · {id}
        </p>
      </header>
      <dl className="grid gap-x-8 gap-y-3 font-sans text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">{t("joined")}</dt>
          <dd>{date(user.created_at)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t("lastSignIn")}</dt>
          <dd>{date(user.last_sign_in_at)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t("lastActivity")}</dt>
          <dd>{date(last.data?.created_at)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t("streak")}</dt>
          <dd>
            {tc("days", { count: streak.data?.current_days ?? 0 })} (
            {tc("longest", { days: tc("days", { count: streak.data?.longest_days ?? 0 }) })})
          </dd>
        </div>
      </dl>

      <section aria-labelledby="roles-h" className="grid gap-3">
        <h2 id="roles-h" className="text-xl">
          {t("rolesTitle")}
        </h2>
        <RoleControls userId={id} roles={roles} />
      </section>

      <section aria-labelledby="ban-h" className="grid gap-3">
        <h2 id="ban-h" className="text-xl">
          {t("ban")}
        </h2>
        {user.banned ? <UnbanButton userId={id} /> : <BanForm userId={id} />}
      </section>

      <section className="grid justify-items-start gap-2">
        <a
          href={`/api/admin/users/${id}/export`}
          download
          className={buttonClass("secondary", "sm")}
        >
          {t("export")}
        </a>
        <p className="font-sans text-xs text-ink-muted">{t("exportNote")}</p>
      </section>
    </div>
  );
}
