import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentProfile } from "@/lib/obe/queries";
import { PageHeader } from "@/components/ui";
import { StudentProfile } from "@/components/StudentProfile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("myDashboard") };
}

export default async function StudentDashboard() {
  const user = await requirePageUser("student");
  const data = await getStudentProfile(user.id);
  if (!data) notFound();
  const t = await getTranslations("profile");
  return (
    <>
      <PageHeader title={t("welcome", { name: data.student.name.split(" ")[0] })} description={t("welcomeDescription")} />
      <StudentProfile data={data} audience="self" />
    </>
  );
}
