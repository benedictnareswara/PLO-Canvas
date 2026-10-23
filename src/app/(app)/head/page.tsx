import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentsWithRows } from "@/lib/obe/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { CohortDashboard } from "@/components/head/CohortDashboard";

export const metadata: Metadata = { title: "Cohort Overview" };

export default async function HeadHome() {
  const user = await requirePageUser("faculty_head");
  const data = await getStudentsWithRows({ departmentId: user.department });
  return (
    <>
      <PageHeader title="Cohort Overview" description="Department-wide Program Learning Outcome attainment by graduation cohort." />
      {data.students.length ? <CohortDashboard data={data} /> : <EmptyState>No students in your department yet.</EmptyState>}
    </>
  );
}
