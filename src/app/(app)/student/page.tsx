import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentProfile } from "@/lib/obe/queries";
import { PageHeader } from "@/components/ui";
import { StudentProfile } from "@/components/StudentProfile";

export const metadata: Metadata = { title: "My Dashboard" };

export default async function StudentDashboard() {
  const user = await requirePageUser("student");
  const data = await getStudentProfile(user.id);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Welcome, ${data.student.name.split(" ")[0]}`} description="Your courses, assessment scores and Program Learning Outcome (PLO) achievement." />
      <StudentProfile data={data} />
    </>
  );
}
