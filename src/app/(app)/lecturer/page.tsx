import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/rbac";
import { listOfferings } from "@/lib/obe/queries";
import { atRiskPlos } from "@/lib/obe/aggregate";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { PloCell } from "@/components/AtRiskBadge";

export const metadata: Metadata = { title: "My Classes" };

export default async function LecturerHome() {
  const user = await requirePageUser("lecturer", "faculty_head");
  const { offerings, plos } = await listOfferings({ lecturer: user.id });
  const current = offerings[0] ? `${offerings[0].academicYear}-${offerings[0].term}` : null;

  return (
    <>
      <PageHeader title="My Classes" description="Course offerings you teach. Class means are PLO attainment averaged over enrolled students." />
      {offerings.length === 0 ? (
        <EmptyState>You are not assigned to any classes yet.</EmptyState>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Course</Th>
                <Th>Period</Th>
                <Th className="text-right">Students</Th>
                <Th className="text-right">Assessments</Th>
                <Th>Class mean by PLO</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => {
                const risky = atRiskPlos(o.plo, o.threshold);
                return (
                  <tr key={o.id} className="hover:bg-background">
                    <Td>
                      <Link href={`/lecturer/offerings/${o.id}`} className="font-medium text-brand hover:underline">
                        {o.code} · {o.title}
                      </Link>
                      <div className="text-xs text-muted">{o.sks} SKS · target {o.threshold}%</div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {o.period} {`${o.academicYear}-${o.term}` === current && <Badge tone="brand" className="ml-1">Current</Badge>}
                    </Td>
                    <Td className="text-right tabular">{o.studentCount}</Td>
                    <Td className="text-right tabular">{o.assessmentCount}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {plos.filter((p) => o.plo[p.number] !== null).map((p) => (
                          <span key={p.id} className="flex items-center gap-1 text-xs">
                            <span className="text-muted">{p.number}</span>
                            <PloCell value={o.plo[p.number]} threshold={o.threshold} />
                          </span>
                        ))}
                        {o.assessmentCount === 0 && <span className="text-xs text-muted">No assessments yet, import from Canvas</span>}
                      </div>
                    </Td>
                    <Td>{risky.length ? <Badge tone="risk">{risky.length} PLO at risk</Badge> : o.assessmentCount ? <Badge tone="ok">On target</Badge> : <Badge>Pending</Badge>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
