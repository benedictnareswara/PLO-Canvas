"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PloRadar } from "@/components/charts/PloRadar";
import { AtRiskBadge, PloCell, formatPct } from "@/components/AtRiskBadge";
import { Badge, Card, CardBody, CardHeader, Select, Stat, Table, Td, Th, cn } from "@/components/ui";
import { atRiskPlos, cumulativeForStudent, toPloValues } from "@/lib/obe/aggregate";
import { PERIOD_FILTERS, inPeriod, type PeriodFilter } from "@/lib/obe/semesters";
import type { StudentCourseView, StudentProfileData } from "@/lib/obe/queries";

export function StudentProfile({ data }: { data: StudentProfileData }) {
  const { student, plos, threshold, rows, courses } = data;
  const [period, setPeriod] = useState<PeriodFilter>("all");

  const maxSemester = Math.max(1, ...courses.map((c) => c.semester));
  const periodOptions = PERIOD_FILTERS.filter((f) => {
    if (f.value === "all") return true;
    const n = Number(f.value.slice(1));
    return f.value.startsWith("y") ? n * 2 - 1 <= maxSemester : n <= maxSemester;
  });

  const values = useMemo(
    () => toPloValues(cumulativeForStudent(rows, student.id, period), plos),
    [rows, student.id, period, plos],
  );
  const risky = atRiskPlos(values, threshold);
  const visibleCourses = courses.filter((c) => inPeriod(c.semester, period));
  const completedSks = courses.filter((c) => c.grade !== null).reduce((s, c) => s + c.sks, 0);
  const evidenced = Object.values(values).filter((v) => v !== null).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cohort" value={student.cohortYear ? `Class of ${student.cohortYear}` : "—"} hint={`NIM ${student.studentId ?? "—"}`} />
        <Stat label="Courses with grades" value={courses.filter((c) => c.grade !== null).length} hint={`${completedSks} SKS assessed`} />
        <Stat label="PLOs with evidence" value={`${evidenced} / ${plos.length}`} hint={periodOptions.find((p) => p.value === period)?.label} />
        <Stat
          label="PLOs at risk"
          value={risky.length}
          tone={risky.length ? "risk" : "ok"}
          hint={risky.length ? risky.map((n) => `PLO ${n}`).join(", ") : `All evidenced PLOs ≥ ${threshold}%`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title="PLO Attainment Spider Chart"
            description={`SKS-weighted attainment against the ${threshold}% passing line`}
            actions={
              <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)} aria-label="Period filter">
                {periodOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            }
          />
          <CardBody>
            <PloRadar plos={plos} threshold={threshold} series={[{ key: "student", label: student.name, values }]} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Outcome Summary" description="Cumulative PLO attainment and status" />
          <div>
            {plos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {p.code} <span className="font-normal text-muted">· {p.shortLabel}</span>
                  </div>
                  <div className="truncate text-xs text-muted" title={p.description}>
                    {p.description}
                  </div>
                </div>
                <AtRiskBadge value={values[p.number]} threshold={threshold} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Courses & Assessment Scores"
          description={student.advisorName ? `Academic advisor (Dosen Wali): ${student.advisorName}` : undefined}
        />
        <div className="divide-y divide-border">
          {visibleCourses.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted">No courses in this period.</div>}
          {visibleCourses.map((c) => (
            <CourseRow key={c.offeringId} course={c} plos={plos} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function CourseRow({ course, plos }: { course: StudentCourseView; plos: StudentProfileData["plos"] }) {
  const [open, setOpen] = useState(false);
  const mapped = plos.filter((p) => course.plo[p.number] !== null);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-left hover:bg-background"
        aria-expanded={open}
      >
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        <div className="min-w-48 flex-1">
          <div className="text-sm font-medium">
            {course.code} · {course.title}
          </div>
          <div className="text-xs text-muted">
            Semester {course.semester} · {course.period} · {course.sks} SKS
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {mapped.map((p) => (
            <span key={p.id} className="flex items-center gap-1 text-xs">
              <span className="text-muted">{p.code}</span>
              <PloCell value={course.plo[p.number]} threshold={course.threshold} />
            </span>
          ))}
        </div>
        <div className="w-28 text-right">
          {course.grade === null ? (
            <Badge>In progress</Badge>
          ) : (
            <span className="text-sm font-semibold tabular">
              {formatPct(course.grade)} <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">{course.letter}</span>
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4">
          <Table>
            <thead>
              <tr>
                <Th>Assessment</Th>
                <Th className="text-right">Score</Th>
                <Th className="text-right">%</Th>
                <Th className="text-right">Grade weight</Th>
                <Th>PLO mapping</Th>
              </tr>
            </thead>
            <tbody>
              {course.assessments.map((a) => (
                <tr key={a.id}>
                  <Td>{a.title}</Td>
                  <Td className="text-right tabular">{a.score === null ? <span className="text-muted">Not graded</span> : `${a.score} / ${a.maxPoints}`}</Td>
                  <Td className="text-right tabular">{formatPct(a.pct)}</Td>
                  <Td className="text-right tabular">{a.gradeWeight ? `${a.gradeWeight}%` : "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {a.plos.map((p) => (
                        <Badge key={p.number} tone="info">
                          PLO {p.number} · {p.weight}%
                        </Badge>
                      ))}
                    </div>
                  </Td>
                </tr>
              ))}
              {course.assessments.length === 0 && (
                <tr>
                  <Td colSpan={5} className="text-center text-muted">
                    No assessments published yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
