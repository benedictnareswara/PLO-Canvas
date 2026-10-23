// Pure aggregation helpers usable on both server and client (for instant period filtering).
import { cohortAggregate, cumulativePloAttainment, isAtRisk, type CohortStat } from "./engine";
import { inPeriod, type PeriodFilter } from "./semesters";
import type { AttainmentRow, PloInfo, PloValues, StudentSummary } from "./types";

export function cumulativeForStudent(rows: AttainmentRow[], studentId: string, period: PeriodFilter = "all") {
  return cumulativePloAttainment(
    rows
      .filter((r) => r.student === studentId && inPeriod(r.studentSemester, period))
      .map((r) => ({ plo: r.ploNumber, value: r.value, sks: r.sks })),
  );
}

export function toPloValues(m: Map<number, number>, plos: PloInfo[]): PloValues {
  return Object.fromEntries(plos.map((p) => [p.number, m.get(p.number) ?? null]));
}

export function atRiskPlos(values: PloValues, threshold: number): number[] {
  return Object.entries(values)
    .filter(([, v]) => isAtRisk(v, threshold))
    .map(([k]) => Number(k))
    .sort((a, b) => a - b);
}

export interface CohortSummary {
  year: number;
  students: (StudentSummary & { values: PloValues; atRisk: number[] })[];
  aggregate: Record<number, CohortStat | null>;
  mean: PloValues;
}

/** Groups students by intake year and computes the cohort aggregate (formula 4). */
export function summarizeCohorts(
  students: StudentSummary[],
  rows: AttainmentRow[],
  plos: PloInfo[],
  threshold: number,
  period: PeriodFilter = "all",
): CohortSummary[] {
  const byYear = new Map<number, StudentSummary[]>();
  for (const s of students) {
    if (!s.cohortYear) continue;
    if (!byYear.has(s.cohortYear)) byYear.set(s.cohortYear, []);
    byYear.get(s.cohortYear)!.push(s);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, members]) => {
      const perStudent = members.map((s) => cumulativeForStudent(rows, s.id, period));
      const agg = cohortAggregate(perStudent);
      return {
        year,
        students: members.map((s, i) => {
          const values = toPloValues(perStudent[i], plos);
          return { ...s, values, atRisk: atRiskPlos(values, threshold) };
        }),
        aggregate: Object.fromEntries(plos.map((p) => [p.number, agg.get(p.number) ?? null])),
        mean: Object.fromEntries(plos.map((p) => [p.number, agg.get(p.number)?.mean ?? null])),
      };
    });
}
