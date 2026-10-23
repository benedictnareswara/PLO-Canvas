import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadCourses, loadInstitution } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { CoursesAdmin } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  await requirePageUser("superadmin");
  const [courses, { curricula, plos }] = await Promise.all([loadCourses(), loadInstitution()]);
  return (
    <>
      <PageHeader title="Courses" description="Course catalogue and curriculum-level PLO mapping." />
      <CoursesAdmin courses={courses} curricula={curricula} plos={plos} />
    </>
  );
}
