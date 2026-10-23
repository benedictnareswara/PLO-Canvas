"use client";

import { useMemo, useState } from "react";
import { PloRadar, SERIES_COLORS } from "@/components/charts/PloRadar";
import { AtRiskBadge } from "@/components/AtRiskBadge";
import { Card, CardBody, CardHeader, Select, Stat, Table, Td, Th } from "@/components/ui";
import { atRiskPlos, summarizeCohorts } from "@/lib/obe/aggregate";
import { PERIOD_FILTERS, type PeriodFilter } from "@/lib/obe/semesters";
import type { StudentsWithRows } from "@/lib/obe/queries";

/** Cohort comparison: one radar polygon per graduation cohort (max three overlaid). */
export function CohortDashboard({ data }: { data: StudentsWithRows }) {
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const cohorts = useMemo(
    () => summarizeCohorts(data.students, data.rows, data.plos, data.threshold, period),
    [data, period],
  );
  const [selected, setSelected] = useState<number[]>(() => cohorts.slice(-3).map((c) => c.year));
  const shown = cohorts.filter((c) => selected.includes(c.year)).slice(0, SERIES_COLORS.length);

  function toggle(year: number) {
    setSelected((s) => (s.includes(year) ? s.filter((y) => y !== year) : s.length >= SERIES_COLORS.length ? s : [...s, year].sort()));
  }

  const totalStudents = data.students.length;
  const studentsAtRisk = cohorts.flatMap((c) => c.students).filter((s) => s.atRisk.length).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Students" value={totalStudents} hint={`${cohorts.length} cohort(s)`} />
        <Stat label="Students needing intervention" value={studentsAtRisk} tone={studentsAtRisk ? "risk" : "ok"} hint="At least one PLO below target" />
        {cohorts.slice(-2).map((c) => {
          const risky = atRiskPlos(c.mean, data.threshold);
          return (
            <Stat
              key={c.year}
              label={`Class of ${c.year}: cohort PLOs at risk`}
              value={risky.length}
              tone={risky.length ? "risk" : "ok"}
              hint={risky.length ? risky.map((n) => `PLO ${n}`).join(", ") : `All cohort means ≥ ${data.threshold}%`}
            />
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Cohort OBE spider chart"
          description={`Cohort aggregate = mean of students' SKS-weighted cumulative PLO attainment. Dashed line: ${data.threshold}% target.`}
          actions={
            <>
              <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Cohorts">
                {cohorts.map((c) => {
                  const idx = shown.findIndex((s) => s.year === c.year);
                  return (
                    <label key={c.year} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" className="accent-brand" checked={selected.includes(c.year)} onChange={() => toggle(c.year)} />
                      {idx >= 0 && <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_COLORS[idx] }} />}
                      Class of {c.year}
                    </label>
                  );
                })}
              </div>
              <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)} aria-label="Period filter">
                {PERIOD_FILTERS.slice(0, 5).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </>
          }
        />
        <CardBody>
          <PloRadar
            plos={data.plos}
            threshold={data.threshold}
            height={440}
            series={shown.map((c) => ({ key: `c${c.year}`, label: `Class of ${c.year} (n=${c.students.length})`, values: c.mean }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cohort comparison" description="Cohort mean per PLO (n = students with evidence for that PLO)" />
        <Table>
          <thead>
            <tr>
              <Th>PLO</Th>
              {cohorts.map((c) => (
                <Th key={c.year} className="text-right">
                  Class of {c.year}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.plos.map((p) => (
              <tr key={p.id}>
                <Td title={p.description}>
                  <span className="font-medium">{p.code}</span> <span className="text-muted">{p.shortLabel}</span>
                </Td>
                {cohorts.map((c) => (
                  <Td key={c.year} className="text-right">
                    <AtRiskBadge value={c.mean[p.number]} threshold={data.threshold} />
                    {c.aggregate[p.number] && <span className="ml-2 text-xs text-muted">n={c.aggregate[p.number]!.n}</span>}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
