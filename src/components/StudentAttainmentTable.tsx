"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PloCell } from "@/components/AtRiskBadge";
import { Badge, Select, Table, Td, Th } from "@/components/ui";
import { atRiskPlos, cumulativeForStudent, toPloValues } from "@/lib/obe/aggregate";
import { PERIOD_FILTERS, type PeriodFilter } from "@/lib/obe/semesters";
import type { AttainmentRow, PloInfo, StudentSummary } from "@/lib/obe/types";

/** Students × PLO matrix of cumulative attainment, with at-risk highlighting and profile links. */
export function StudentAttainmentTable({
  students,
  rows,
  plos,
  threshold,
  showPeriodFilter = true,
  onlyAtRisk = false,
}: {
  students: StudentSummary[];
  rows: AttainmentRow[];
  plos: PloInfo[];
  threshold: number;
  showPeriodFilter?: boolean;
  onlyAtRisk?: boolean;
}) {
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const computed = useMemo(
    () =>
      students.map((s) => {
        const values = toPloValues(cumulativeForStudent(rows, s.id, period), plos);
        return { ...s, values, risky: atRiskPlos(values, threshold) };
      }),
    [students, rows, plos, period, threshold],
  );
  const shown = onlyAtRisk ? computed.filter((s) => s.risky.length) : computed;

  return (
    <div>
      {showPeriodFilter && (
        <div className="flex justify-end px-5 pt-4">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)} aria-label="Period filter">
            {PERIOD_FILTERS.slice(0, 5).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Table className="mt-2">
        <thead>
          <tr>
            <Th>Student</Th>
            <Th>Cohort</Th>
            {plos.map((p) => (
              <Th key={p.id} className="text-center" title={p.description}>
                {p.number}
              </Th>
            ))}
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.id} className="hover:bg-background">
              <Td>
                <Link href={`/students/${s.id}`} className="font-medium text-brand hover:underline">
                  {s.name}
                </Link>
                <div className="text-xs text-muted">NIM {s.studentId ?? "—"}</div>
              </Td>
              <Td className="whitespace-nowrap">{s.cohortYear ?? "—"}</Td>
              {plos.map((p) => (
                <Td key={p.id} className="text-center">
                  <PloCell value={s.values[p.number]} threshold={threshold} />
                </Td>
              ))}
              <Td>
                {s.risky.length ? (
                  <Badge tone="risk">{s.risky.length} at risk</Badge>
                ) : (
                  <Badge tone="ok">On track</Badge>
                )}
              </Td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <Td colSpan={plos.length + 3} className="py-8 text-center text-muted">
                No students to show.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
