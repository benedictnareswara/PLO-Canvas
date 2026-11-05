import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Library } from "lucide-react";
import { requirePageUser } from "@/lib/auth/rbac";
import { listOfferings } from "@/lib/obe/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { CourseMatrix } from "@/components/head/CourseMatrix";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("courseAttainment") };
}

export default async function CourseAttainmentPage() {
  const user = await requirePageUser("faculty_head");
  const t = await getTranslations("analytics.pages");
  const { offerings, plos } = await listOfferings({ departmentId: user.department });
  return (
    <>
      <PageHeader title={t("coursesTitle")} description={t("coursesDescription")} />
      {offerings.length ? <CourseMatrix offerings={offerings} plos={plos} /> : <EmptyState icon={<Library />} title={t("noClassesTitle")} description={t("noClassesBody")} />}
    </>
  );
}
