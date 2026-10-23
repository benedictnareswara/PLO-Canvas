import "server-only";
import { Course, CourseOffering, Curriculum, Department, Enrollment, Faculty, Plo, User } from "@/models";

/** Converts lean Mongo documents (ObjectIds, Dates) into plain JSON for client components. */
export function plain<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type Id = { _id: string };
export type FacultyRow = Id & { code: string; name: string };
export type DepartmentRow = Id & { code: string; name: string; faculty: string };
export type CurriculumRow = Id & { name: string; year: number; totalSks: number; department: string; defaultThreshold: number; isActive: boolean };
export type PloRow = Id & { curriculum: string; number: number; code: string; shortLabel: string; description: string };
export type CourseRow = Id & { curriculum: string; code: string; title: string; sks: number; semester: number; plos: string[] };
export type OfferingRow = Id & { course: string; academicYear: number; term: "odd" | "even"; section: string; lecturers: string[]; threshold: number };
export type UserRow = Id & {
  email: string;
  name: string;
  roles: string[];
  department?: string | null;
  studentId?: string | null;
  cohortYear?: number | null;
  curriculum?: string | null;
  advisor?: string | null;
  staffId?: string | null;
  isActive: boolean;
};

export async function loadInstitution() {
  const [faculties, departments, curricula, plos] = await Promise.all([
    Faculty.find().sort({ code: 1 }).lean(),
    Department.find().sort({ code: 1 }).lean(),
    Curriculum.find().sort({ year: -1 }).lean(),
    Plo.find().sort({ number: 1 }).lean(),
  ]);
  return {
    faculties: plain<FacultyRow[]>(faculties),
    departments: plain<DepartmentRow[]>(departments),
    curricula: plain<CurriculumRow[]>(curricula),
    plos: plain<PloRow[]>(plos),
  };
}

export async function loadCourses() {
  return plain<CourseRow[]>(await Course.find().sort({ semester: 1, code: 1 }).lean());
}

export async function loadOfferings() {
  const [offerings, enrollments] = await Promise.all([
    CourseOffering.find().sort({ academicYear: -1, term: -1 }).lean(),
    Enrollment.find().select("offering student").lean(),
  ]);
  const roster: Record<string, string[]> = {};
  for (const e of enrollments) (roster[String(e.offering)] ??= []).push(String(e.student));
  return { offerings: plain<OfferingRow[]>(offerings), roster };
}

export async function loadUsers() {
  return plain<UserRow[]>(await User.find().sort({ roles: 1, name: 1 }).lean());
}
