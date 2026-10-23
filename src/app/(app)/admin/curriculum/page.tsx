import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadInstitution } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { CurriculumAdmin } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Curriculum & PLOs" };

export default async function CurriculumPage() {
  await requirePageUser("superadmin");
  const data = await loadInstitution();
  return (
    <>
      <PageHeader title="Curriculum & PLOs" description="Faculties → Departments → Curricula → Program Learning Outcomes." />
      <CurriculumAdmin {...data} />
    </>
  );
}
