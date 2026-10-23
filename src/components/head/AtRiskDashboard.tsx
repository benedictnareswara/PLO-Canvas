"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Badge, Card, CardHeader, Input, Select, Table, Td, Th, cn } from "@/components/ui";
import { formatPct } from "@/components/AtRiskBadge";
import { StudentAttainmentTable } from "@/components/StudentAttainmentTable";
import { isAtRisk } from "@/lib/obe/engine";
import { summarizeCohorts } from "@/lib/obe/aggregate";
import { PERIOD_FILTERS, type PeriodFilter } from "@/lib/obe/semesters";
import type { StudentsWithRows } from "@/lib/obe/queries";

/**
 * At-risk detection engine: cohort × PLO means flagged below the threshold, with a
 * drill-down to the individual students who need academic intervention.
 */
export function AtRiskDashboard({ data }: { data: StudentsWithRows }) {
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [threshold, setThreshold] = useState(data.threshold);
  const cohorts = useMemo(() => summarizeCohorts(data.students, data.rows, data.plos, threshold, period), [data, threshold, period]);
  const [drill, setDrill] = useState<{ year: number; plo: number } | null>(null);

  const drillCohort = drill ? cohorts.find((c) => c.year === drill.year) : null;
  const drillPlo = drill ? data.plos.find((p) => p.number === drill.plo) : null;
  const drillStudents = drillCohort
    ? drillCohort.students
        .filter((s) => isAtRisk(s.values[drill!.plo], threshold))
        .sort((a, b) => (a.values[drill!.plo] ?? 0) - (b.values[drill!.plo] ?? 0))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Period</span>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)}>
            {PERIOD_FILTERS.slice(0, 5).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Passing threshold (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            className="w-28"
            value={threshold}
            onChange={(e) => setThreshold(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          />
        </label>
      </div>

      <Card>
        <CardHeader
          title="Cohort PLO matrix"
          description="Each cell shows the cohort mean and how many students fall below the threshold. Select a cell to see those students."
        />
        <Table>
          <thead>
            <tr>
              <Th>PLO</Th>
              {cohorts.map((c) => (
                <Th key={c.year} className="text-center">
                  Class of {c.year} <span className="font-normal normal-case">(n={c.students.length})</span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.plos.map((p) => (
              <tr key={p.id}>
                <Td title={p.description}>
                  <div className="font-medium">{p.code}</div>
                  <div className="text-xs text-muted">{p.shortLabel}</div>
                </Td>
                {cohorts.map((c) => {
                  const mean = c.mean[p.number];
                  const below = c.students.filter((s) => isAtRisk(s.values[p.number], threshold)).length;
                  const cohortRisk = isAtRisk(mean, threshold);
                  const active = drill?.year === c.year && drill.plo === p.number;
                  return (
                    <Td key={c.year} className="text-center">
                      {mean === null ? (
                        <span className="text-xs text-muted">No evidence yet</span>
                      ) : (
                        <button
                          onClick={() => setDrill(active ? null : { year: c.year, plo: p.number })}
                          disabled={below === 0}
                          className={cn(
                            "inline-flex min-w-40 items-center justify-center gap-2 rounded-md border px-2 py-1 text-sm tabular transition-colors",
                            cohortRisk ? "border-risk/30 bg-risk-soft text-risk" : "border-transparent bg-ok-soft text-ok",
                            below > 0 && "hover:ring-2 hover:ring-brand/30",
                            active && "ring-2 ring-brand",
                          )}
                        >
                          {cohortRisk && <AlertTriangle className="size-3.5" />}
                          <span className="font-semibold">{formatPct(mean)}</span>
                          {below > 0 ? (
                            <span className="rounded bg-surface px-1.5 text-xs font-medium text-risk">{below} below</span>
                          ) : (
                            <span className="text-xs">all met</span>
                          )}
                        </button>
                      )}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {drill && drillCohort && drillPlo && (
        <Card className="border-brand/40">
          <CardHeader
            title={`Class of ${drill.year} · ${drillPlo.code} below ${threshold}%`}
            description={drillPlo.description}
            actions={
              <button className="text-sm text-muted hover:text-foreground" onClick={() => setDrill(null)}>
                Close
              </button>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th className="text-right">{drillPlo.code}</Th>
                <Th className="text-right">Gap to target</Th>
                <Th>Other at-risk PLOs</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {drillStudents.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted">NIM {s.studentId}</div>
                  </Td>
                  <Td className="text-right font-semibold text-risk tabular">{formatPct(s.values[drill.plo])}</Td>
                  <Td className="text-right tabular">−{(threshold - (s.values[drill.plo] ?? 0)).toFixed(1)} pts</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {s.atRisk.filter((n) => n !== drill.plo).map((n) => (
                        <Badge key={n} tone="risk">
                          PLO {n}
                        </Badge>
                      ))}
                      {s.atRisk.filter((n) => n !== drill.plo).length === 0 && <span className="text-xs text-muted">None</span>}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/students/${s.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                      Profile <ArrowRight className="size-3.5" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader title="Students needing academic intervention" description={`Students with at least one cumulative PLO below ${threshold}%`} />
        <StudentAttainmentTable
          key={`${threshold}`}
          students={data.students}
          rows={data.rows}
          plos={data.plos}
          threshold={threshold}
          onlyAtRisk
        />
      </Card>
    </div>
  );
}
