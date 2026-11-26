import type { Term } from "@/models";

/**
 * A student's semester number for an offering, counted from their intake (cohort) year.
 * Cohort 2023 taking a 2023/2024 odd-term class → semester 1; 2024/2025 even → semester 4.
 */
export function studentSemester(cohortYear: number, academicYear: number, term: Term): number {
  return (academicYear - cohortYear) * 2 + (term === "even" ? 2 : 1);
}

/**
 * The semester a student's result in a class is filed under. Without a cohort year, or for a class
 * dated before the student's intake (a data entry mistake, giving semester 0 or less), the course's
 * planned semester is used, so the result still counts in the cumulative and period filters.
 */
export function semesterForStudent(cohortYear: number | null | undefined, academicYear: number, term: Term, courseSemester: number): number {
  if (!cohortYear) return courseSemester;
  const semester = studentSemester(cohortYear, academicYear, term);
  return semester >= 1 ? semester : courseSemester;
}

/** Position of a term in time: within an academic year the odd term (Aug–Dec) comes before the even one (Feb–Jun). */
export function periodIndex(academicYear: number, term: string): number {
  return academicYear * 2 + (term === "even" ? 1 : 0);
}

/** Sort comparator for classes, newest term first: 2025/2026 Even, then 2025/2026 Odd, then 2024/2025 Even. */
export function newestPeriodFirst(a: { academicYear: number; term: string }, b: { academicYear: number; term: string }): number {
  return periodIndex(b.academicYear, b.term) - periodIndex(a.academicYear, a.term);
}

/**
 * The same order for a MongoDB `.sort()`. Terms are stored as text, and "even" sorts before "odd",
 * so ascending text order puts the later (even) term first within a year. Sorting `term: -1`
 * instead lists Odd before Even, which is not chronological.
 */
export const NEWEST_PERIOD_FIRST = { academicYear: -1, term: 1 } as const;

export function academicYearLabel(academicYear: number): string {
  return `${academicYear}/${academicYear + 1}`;
}

export function termLabel(term: Term): string {
  return term === "odd" ? "Odd (Ganjil)" : "Even (Genap)";
}

export function offeringPeriodLabel(academicYear: number, term: Term): string {
  return `${academicYearLabel(academicYear)} · ${term === "odd" ? "Odd" : "Even"}`;
}

/** Radar progression filters: cumulative to date, by study year, or by single semester. */
export type PeriodFilter = "all" | `y${1 | 2 | 3 | 4}` | `s${number}`;

export const PERIOD_FILTERS: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "Cumulative to date" },
  { value: "y1", label: "Year 1 (Sem 1–2)" },
  { value: "y2", label: "Year 2 (Sem 3–4)" },
  { value: "y3", label: "Year 3 (Sem 5–6)" },
  { value: "y4", label: "Year 4 (Sem 7–8)" },
  ...Array.from({ length: 8 }, (_, i) => ({ value: `s${i + 1}` as PeriodFilter, label: `Semester ${i + 1}` })),
];

export function semesterRange(filter: PeriodFilter): [number, number] {
  if (filter === "all") return [1, 99];
  const n = Number(filter.slice(1));
  if (filter.startsWith("y")) return [n * 2 - 1, n * 2];
  return [n, n];
}

export function inPeriod(semester: number, filter: PeriodFilter): boolean {
  const [from, to] = semesterRange(filter);
  return semester >= from && semester <= to;
}

export function parsePeriodFilter(raw: string | undefined | null): PeriodFilter {
  if (!raw) return "all";
  return PERIOD_FILTERS.some((f) => f.value === raw) ? (raw as PeriodFilter) : "all";
}
