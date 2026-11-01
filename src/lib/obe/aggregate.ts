// Pure aggregation helpers usable on both server and client (for instant period filtering).
import { cohortAggregate, isAtRisk, type CohortStat } from "./engine";
import { inPeriod, type PeriodFilter } from "./semesters";
import type { AttainmentRow, AttainmentSum, PloInfo, PloValues, StudentSummary } from "./types";

/**
 * Same grouping as the $group in getAttainmentSums (and the same exclusions as
 * cumulativePloAttainment: rows without positive SKS or a finite value don't count).
 */
export function rowsToSums(rows: AttainmentRow[]): AttainmentSum[] {
  const acc = new Map<string, AttainmentSum>();
  for (const r of rows) {
    if (!(r.sks > 0) || !Number.isFinite(r.value)) continue;
    const key = `${r.student}|${r.studentSemester}|${r.ploNumber}`;
    const cur = acc.get(key) ?? { student: r.student, studentSemester: r.studentSemester, ploNumber: r.ploNumber, sum: 0, sks: 0 };
    cur.sum += r.value * r.sks;
    cur.sks += r.sks;
    acc.set(key, cur);
  }
  return [...acc.values()];
}

// Sums grouped by student, computed once per array (dashboards call this for every student).
const byStudentCache = new WeakMap<AttainmentSum[], Map<string, AttainmentSum[]>>();
function sumsOf(sums: AttainmentSum[], studentId: string): AttainmentSum[] {
  let index = byStudentCache.get(sums);
  if (!index) {
    index = new Map();
    for (const s of sums) {
      const list = index.get(s.student);
      if (list) list.push(s);
      else index.set(s.student, [s]);
    }
    byStudentCache.set(sums, index);
  }
  return index.get(studentId) ?? [];
}

/** SKS-weighted cumulative PLO attainment (formula 3) of one student over the chosen period. */
export function cumulativeForStudent(sums: AttainmentSum[], studentId: string, period: PeriodFilter = "all"): Map<number, number> {
  const acc = new Map<number, { sum: number; sks: number }>();
  for (const s of sumsOf(sums, studentId)) {
    if (!inPeriod(s.studentSemester, period)) continue;
    const cur = acc.get(s.ploNumber) ?? { sum: 0, sks: 0 };
    cur.sum += s.sum;
    cur.sks += s.sks;
    acc.set(s.ploNumber, cur);
  }
  const out = new Map<number, number>();
  for (const [plo, { sum, sks }] of acc) if (sks > 0) out.set(plo, sum / sks);
  return out;
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
  sums: AttainmentSum[],
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
      const perStudent = members.map((s) => cumulativeForStudent(sums, s.id, period));
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
