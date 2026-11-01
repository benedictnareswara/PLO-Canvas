import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentsWithRows } from "@/lib/obe/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { CohortDashboard } from "@/components/head/CohortDashboard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("cohortOverview") };
}

export default async function HeadHome() {
  const user = await requirePageUser("faculty_head");
  const t = await getTranslations("analytics.pages");
  const data = await getStudentsWithRows({ departmentId: user.department });
  return (
    <>
      <PageHeader title={t("cohortTitle")} description={t("cohortDescription")} />
      {data.students.length ? <CohortDashboard data={data} /> : <EmptyState icon={<Users />} title={t("noStudentsTitle")} description={t("noStudentsBody")} />}
    </>
  );
}
