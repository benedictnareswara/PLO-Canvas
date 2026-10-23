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

export interface StudentSummary {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  cohortYear: number | null;
  advisorName?: string | null;
}
