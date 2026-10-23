import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { listOfferings } from "@/lib/obe/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { CourseMatrix } from "@/components/head/CourseMatrix";

export const metadata: Metadata = { title: "Course Attainment" };

export default async function CourseAttainmentPage() {
  const user = await requirePageUser("faculty_head");
  const { offerings, plos } = await listOfferings({ departmentId: user.department });
  return (
    <>
      <PageHeader
        title="Course Attainment Overview"
        description="PLO matrices across every offered class in the department. Open a class for its read-only gradebook and radar."
      />
      {offerings.length ? <CourseMatrix offerings={offerings} plos={plos} /> : <EmptyState>No course offerings yet.</EmptyState>}
    </>
  );
}
