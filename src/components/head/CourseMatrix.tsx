"use client";

import Link from "next/link";
import { useState } from "react";
import { PloCell } from "@/components/AtRiskBadge";
import { Badge, Card, CardHeader, Select, Table, Td, Th } from "@/components/ui";
import { atRiskPlos } from "@/lib/obe/aggregate";
import { academicYearLabel } from "@/lib/obe/semesters";
import type { OfferingListItem } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";

/** Offerings × PLO heatmap of class-mean attainment, filterable by academic year and term. */
export function CourseMatrix({ offerings, plos }: { offerings: OfferingListItem[]; plos: PloInfo[] }) {
  const years = [...new Set(offerings.map((o) => o.academicYear))].sort((a, b) => b - a);
  const [year, setYear] = useState<string>("all");
  const [term, setTerm] = useState<string>("all");
  const shown = offerings.filter((o) => (year === "all" || o.academicYear === Number(year)) && (term === "all" || o.term === term));

  return (
    <Card>
      <CardHeader
        title="PLO attainment matrix"
        description="Class mean of course-level PLO attainment. Each class is judged against its own threshold."
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Academic year">
              <option value="all">All academic years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {academicYearLabel(y)}
                </option>
              ))}
            </Select>
            <Select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term">
              <option value="all">Both terms</option>
              <option value="odd">Odd</option>
              <option value="even">Even</option>
            </Select>
          </>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Class</Th>
            <Th>Lecturer</Th>
            <Th className="text-right">n</Th>
            {plos.map((p) => (
              <Th key={p.id} className="text-center" title={p.description}>
                {p.number}
              </Th>
            ))}
            <Th>Flags</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((o) => {
            const risky = atRiskPlos(o.plo, o.threshold);
            return (
              <tr key={o.id} className="hover:bg-background">
                <Td>
                  <Link href={`/lecturer/offerings/${o.id}`} className="font-medium text-brand hover:underline">
                    {o.code}
                  </Link>
                  <div className="whitespace-nowrap text-xs text-muted">
                    {o.period} · {o.threshold}%
                  </div>
                </Td>
                <Td className="text-xs">{o.lecturers.join(", ")}</Td>
                <Td className="text-right tabular">{o.studentCount}</Td>
                {plos.map((p) => (
                  <Td key={p.id} className="text-center">
                    {o.plo[p.number] === null ? <span className="text-border">·</span> : <PloCell value={o.plo[p.number]} threshold={o.threshold} />}
                  </Td>
                ))}
                <Td>{risky.length ? <Badge tone="risk">{risky.length} at risk</Badge> : o.assessmentCount ? <Badge tone="ok">OK</Badge> : <Badge>No data</Badge>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
