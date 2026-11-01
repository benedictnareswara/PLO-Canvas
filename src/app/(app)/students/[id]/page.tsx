import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canViewStudent, getCurrentUser, requirePageUser } from "@/lib/auth/rbac";
import { studentBackLink } from "@/lib/back-link";
import { getStudentProfile } from "@/lib/obe/queries";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { StudentProfile } from "@/components/StudentProfile";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !(await canViewStudent(user, id))) return {};
  const data = await getStudentProfile(id);
  return data ? { title: data.student.name } : {};
}

/** Shared student profile for advisors, faculty heads and superadmins. */
export default async function StudentProfilePage({ params, searchParams }: Props) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const user = await requirePageUser();
  if (!(await canViewStudent(user, id))) notFound();
  const data = await getStudentProfile(id);
  if (!data) notFound();
  const t = await getTranslations();
  const back = studentBackLink(from, user.roles);
  return (
    <>
      <Breadcrumbs label={t("shell.breadcrumb")} items={[{ href: back.href, label: t(back.labelKey) }, { label: data.student.name }]} />
      <PageHeader title={data.student.name} description={`${data.student.email} · NIM ${data.student.studentId ?? "—"}`} />
      <StudentProfile data={data} audience="staff" />
    </>
  );
}
