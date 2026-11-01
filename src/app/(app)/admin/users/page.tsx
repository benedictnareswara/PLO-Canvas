import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadInstitution, loadUsers } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { UsersAdmin } from "@/components/admin/AdminViews";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("users") };
}

export default async function UsersPage() {
  await requirePageUser("superadmin");
  const t = await getTranslations("admin.pages");
  const [users, { departments, curricula }] = await Promise.all([loadUsers(), loadInstitution()]);
  return (
    <>
      <PageHeader title={t("usersTitle")} description={t("usersDescription")} />
      <UsersAdmin users={users} departments={departments} curricula={curricula} />
    </>
  );
}
