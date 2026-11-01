import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentsWithRows } from "@/lib/obe/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { AdviseesView } from "@/components/advisor/AdviseesView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("myAdvisees") };
}

export default async function AdviseesPage() {
  const user = await requirePageUser("lecturer", "faculty_head");
  const t = await getTranslations("advisees");
  const data = await getStudentsWithRows({ advisor: user.id });
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {data.students.length === 0 ? <EmptyState icon={<Users />} title={t("emptyTitle")} description={t("emptyBody")} /> : <AdviseesView data={data} />}
    </>
  );
}
