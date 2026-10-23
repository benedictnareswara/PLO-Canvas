import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canViewStudent, hasRole, requirePageUser } from "@/lib/auth/rbac";
import { getStudentProfile } from "@/lib/obe/queries";
import { PageHeader } from "@/components/ui";
import { StudentProfile } from "@/components/StudentProfile";

export const metadata: Metadata = { title: "Student Profile" };

/** Shared student profile for advisors, faculty heads and superadmins. */
export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  if (!(await canViewStudent(user, id))) notFound();
  const data = await getStudentProfile(id);
  if (!data) notFound();
  const back = hasRole(user, "faculty_head") ? { href: "/head/at-risk", label: "At-Risk Detection" } : { href: "/lecturer/advisees", label: "My Advisees" };
  return (
    <>
      <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> {back.label}
      </Link>
      <PageHeader title={data.student.name} description={`${data.student.email} · NIM ${data.student.studentId ?? "—"}`} />
      <StudentProfile data={data} />
    </>
  );
}
