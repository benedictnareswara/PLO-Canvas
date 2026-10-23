import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentsWithRows } from "@/lib/obe/queries";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { StudentAttainmentTable } from "@/components/StudentAttainmentTable";

export const metadata: Metadata = { title: "My Advisees" };

export default async function AdviseesPage() {
  const user = await requirePageUser("lecturer", "faculty_head");
  const data = await getStudentsWithRows({ advisor: user.id });

  return (
    <>
      <PageHeader
        title="My Advisees"
        description="Students you supervise as Academic Advisor (Dosen Wali). Open a student to see their cumulative spider chart and course history."
      />
      {data.students.length === 0 ? (
        <EmptyState>No students are assigned to you as advisees.</EmptyState>
      ) : (
        <Card>
          <CardHeader
            title="Cumulative PLO attainment"
            description={`SKS-weighted across all assessed courses. Cells below ${data.threshold}% are flagged At-Risk.`}
          />
          <StudentAttainmentTable students={data.students} rows={data.rows} plos={data.plos} threshold={data.threshold} />
        </Card>
      )}
    </>
  );
}
