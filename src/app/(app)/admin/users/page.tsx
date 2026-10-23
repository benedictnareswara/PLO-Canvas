import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadInstitution, loadUsers } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { UsersAdmin } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Users & Advisors" };

export default async function UsersPage() {
  await requirePageUser("superadmin");
  const [users, { departments, curricula }] = await Promise.all([loadUsers(), loadInstitution()]);
  return (
    <>
      <PageHeader title="Users & Academic Advisors" description="Manage accounts and roles, and assign lecturers as Dosen Wali." />
      <UsersAdmin users={users} departments={departments} curricula={curricula} />
    </>
  );
}
