import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadInstitution } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { CurriculumAdmin } from "@/components/admin/AdminViews";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("curriculum") };
}

export default async function CurriculumPage() {
  await requirePageUser("superadmin");
  const t = await getTranslations("admin.pages");
  const data = await loadInstitution();
  return (
    <>
      <PageHeader title={t("curriculumTitle")} description={t("curriculumDescription")} />
      <CurriculumAdmin {...data} />
    </>
  );
}
