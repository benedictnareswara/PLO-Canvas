import type { Role } from "@/models";

export interface SearchUser {
  id: string;
  roles: Role[];
  department: string | null;
}

/** MongoDB filters (ids as strings) limiting each search to what the user may open; null = not searchable. */
export interface SearchScope {
  students: Record<string, unknown> | null;
  offerings: Record<string, unknown> | null;
  courses: Record<string, unknown> | null;
}

/**
 * The search equivalent of canViewStudent / canAccessOffering: results are filtered in the query
 * itself, so records the user can't open are never fetched.
 * - superadmin: everything
 * - faculty head: students of their department or their advisees; classes they teach or of their
 *   department's courses
 * - lecturer: their advisees; classes they teach
 * - student: nothing (their own pages are in the navigation)
 */
export function searchScope(user: SearchUser, ctx: { departmentCourseIds: string[] }): SearchScope {
  const has = (...r: Role[]) => r.some((x) => user.roles.includes(x));
  if (has("superadmin")) return { students: { roles: "student" }, offerings: {}, courses: {} };

  const isHead = has("faculty_head");
  const isLecturer = has("lecturer", "faculty_head");
  if (!isLecturer) return { students: null, offerings: null, courses: null };

  const studentOr: Record<string, unknown>[] = [{ advisor: user.id }];
  if (isHead && user.department) studentOr.push({ department: user.department });

  const offeringOr: Record<string, unknown>[] = [{ lecturers: user.id }];
  if (isHead && ctx.departmentCourseIds.length) offeringOr.push({ course: { $in: ctx.departmentCourseIds } });

  return {
    students: { roles: "student", $or: studentOr },
    offerings: { $or: offeringOr },
    courses: null,
  };
}

/** Escapes user input for a case-insensitive "contains" regex. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
