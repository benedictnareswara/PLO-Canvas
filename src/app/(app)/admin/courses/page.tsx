import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadCourses, loadInstitution } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { CoursesAdmin } from "@/components/admin/AdminViews";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("courses") };
}

export default async function CoursesPage() {
  await requirePageUser("superadmin");
  const t = await getTranslations("admin.pages");
  const [courses, { curricula, plos }] = await Promise.all([loadCourses(), loadInstitution()]);
  return (
    <>
      <PageHeader title={t("coursesTitle")} description={t("coursesDescription")} />
      <CoursesAdmin courses={courses} curricula={curricula} plos={plos} />
    </>
  );
}
