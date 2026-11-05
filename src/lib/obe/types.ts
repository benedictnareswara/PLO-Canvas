// Serializable shapes shared by server queries and client components.

export interface PloInfo {
  id: string;
  number: number;
  code: string;
  shortLabel: string;
  description: string;
}

/** PLO number (1–10) → attainment %, or null when there is no evidence yet. */
export type PloValues = Record<number, number | null>;

/** One course-level PLO attainment row (PLO_c,k for one student). */
export interface AttainmentRow {
  student: string;
  offering: string;
  courseCode: string;
  ploNumber: number;
  value: number;
  sks: number;
  studentSemester: number;
}

/**
 * Pre-aggregated attainment for one student, semester and PLO: Σ(value × SKS) and Σ SKS over the
 * course-level rows. Cumulative attainment over any set of semesters is Σsum / Σsks, exactly the
 * SKS-weighted mean of the underlying rows, so pages can ship these instead of every row.
 */
export interface AttainmentSum {
  student: string;
  studentSemester: number;
  ploNumber: number;
  sum: number;
  sks: number;
}

/**
 * AttainmentSum[] packed for transport: student ids once, then five numbers per entry
 * (student index, semester, PLO, sum, SKS). About a third of the JSON size of the objects.
 */
export interface PackedSums {
  students: string[];
  data: number[];
}

export interface StudentSummary {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  cohortYear: number | null;
  advisorName?: string | null;
}
