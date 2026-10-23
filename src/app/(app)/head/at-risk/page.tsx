import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentsWithRows } from "@/lib/obe/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { AtRiskDashboard } from "@/components/head/AtRiskDashboard";

export const metadata: Metadata = { title: "At-Risk Detection" };

export default async function AtRiskPage() {
  const user = await requirePageUser("faculty_head");
  const data = await getStudentsWithRows({ departmentId: user.department });
  return (
    <>
      <PageHeader
        title="At-Risk Detection"
        description="PLOs falling below the passing threshold across each cohort, with drill-down to students who need academic intervention."
      />
      {data.students.length ? <AtRiskDashboard data={data} /> : <EmptyState>No students in your department yet.</EmptyState>}
    </>
  );
}
