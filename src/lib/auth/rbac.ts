import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectDB } from "@/lib/db";
import { SESSION_COOKIE, homeForRoles, verifySession } from "./session";
import { Course, CourseOffering, Curriculum, User, type Role } from "@/models";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  department: string | null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Reads the session cookie and reloads the user so role changes apply immediately. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  await connectDB();
  const user = await User.findById(session.sub).lean();
  if (!user || user.isActive === false) return null;
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    roles: user.roles as Role[],
    department: user.department ? String(user.department) : null,
  };
});

export function hasRole(user: CurrentUser, ...roles: Role[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}

/** Page guard: redirects to /login (no session) or the user's home (wrong role). */
export async function requirePageUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !hasRole(user, ...roles)) redirect(homeForRoles(user.roles));
  return user;
}

/** API guard: throws 401/403 HttpErrors, turned into JSON by `apiHandler`. */
export async function requireApiUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  if (roles.length && !hasRole(user, ...roles)) throw new HttpError(403, "Forbidden");
  return user;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with uniform error → JSON mapping. */
export function apiHandler<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      await connectDB();
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
          { status: 400 },
        );
      }
      if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
        return NextResponse.json({ error: "A record with the same unique key already exists" }, { status: 409 });
      }
      console.error(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

async function departmentOfOffering(offeringId: string): Promise<string | null> {
  const offering = await CourseOffering.findById(offeringId).select("course").lean();
  if (!offering) return null;
  const course = await Course.findById(offering.course).select("curriculum").lean();
  const curriculum = course ? await Curriculum.findById(course.curriculum).select("department").lean() : null;
  return curriculum ? String(curriculum.department) : null;
}

export type AccessMode = "read" | "write";

/**
 * Offering access:
 *  - assigned lecturers: read + write
 *  - superadmin: read + write
 *  - faculty head of the offering's department: read only
 */
export async function canAccessOffering(user: CurrentUser, offeringId: string, mode: AccessMode): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(offeringId)) return false;
  if (hasRole(user, "superadmin")) return true;
  const offering = await CourseOffering.findById(offeringId).select("lecturers").lean();
  if (!offering) return false;
  if (hasRole(user, "lecturer", "faculty_head") && offering.lecturers.some((l) => String(l) === user.id)) return true;
  if (mode === "read" && hasRole(user, "faculty_head")) {
    return (await departmentOfOffering(offeringId)) === user.department;
  }
  return false;
}

export async function assertOfferingAccess(user: CurrentUser, offeringId: string, mode: AccessMode) {
  if (!(await canAccessOffering(user, offeringId, mode))) throw new HttpError(403, "You do not have access to this class");
}

/** Student profile access: the student, their academic advisor, a faculty head of their department, or superadmin. */
export async function canViewStudent(user: CurrentUser, studentId: string): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(studentId)) return false;
  if (user.id === studentId) return true;
  if (hasRole(user, "superadmin")) return true;
  const student = await User.findById(studentId).select("advisor department roles").lean();
  if (!student || !student.roles.includes("student")) return false;
  if (student.advisor && String(student.advisor) === user.id) return true;
  if (hasRole(user, "faculty_head") && student.department && String(student.department) === user.department) return true;
  return false;
}
