import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, requireApiUser } from "@/lib/auth/rbac";
import { escapeRegex, searchScope } from "@/lib/search/scope";
import type { SearchResults } from "@/lib/search/types";
import { offeringPeriodLabel } from "@/lib/obe/semesters";
import { Course, CourseOffering, Curriculum, Types, User } from "@/models";

const querySchema = z.object({ q: z.string().trim().min(2).max(64) });
const LIMIT = 8;

/** Turns string ids in a scope filter into ObjectIds for the query. */
function oids(filter: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(filter), (key, value) => {
    if (["advisor", "department", "lecturers"].includes(key) && typeof value === "string") return new Types.ObjectId(value);
    if (key === "$in" && Array.isArray(value)) return value.map((v) => (Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : v));
    return value;
  });
}

/** Global search for the command palette, scoped to what the caller may open. */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser();
  const { q } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const rx = new RegExp(escapeRegex(q), "i");

  const departmentCourseIds =
    user.department && user.roles.includes("faculty_head")
      ? (await Course.find({ curriculum: { $in: await Curriculum.find({ department: user.department }).distinct("_id") } }).distinct("_id")).map(String)
      : [];
  const scope = searchScope(user, { departmentCourseIds });

  const [students, matchingCourses] = await Promise.all([
    scope.students
      ? User.find({ $and: [oids(scope.students), { $or: [{ name: rx }, { email: rx }, { studentId: rx }] }] })
          .select("name studentId cohortYear")
          .sort({ name: 1 })
          .limit(LIMIT)
          .lean()
      : [],
    scope.offerings || scope.courses ? Course.find({ $or: [{ code: rx }, { title: rx }] }).select("code title").limit(50).lean() : [],
  ]);

  const courseById = new Map(matchingCourses.map((c) => [String(c._id), c]));
  const offerings = scope.offerings && matchingCourses.length
    ? await CourseOffering.find({ $and: [oids(scope.offerings), { course: { $in: matchingCourses.map((c) => c._id) } }] })
        .select("course academicYear term")
        .sort({ academicYear: -1, term: -1 })
        .limit(LIMIT)
        .lean()
    : [];

  const results: SearchResults = {
    students: students.map((s) => ({ id: String(s._id), name: s.name, studentId: s.studentId ?? null, cohortYear: s.cohortYear ?? null })),
    classes: offerings.map((o) => {
      const c = courseById.get(String(o.course));
      return { id: String(o._id), code: c?.code ?? "", title: c?.title ?? "", period: offeringPeriodLabel(o.academicYear, o.term) };
    }),
    courses: scope.courses ? matchingCourses.slice(0, LIMIT).map((c) => ({ id: String(c._id), code: c.code, title: c.title })) : [],
  };
  return NextResponse.json(results);
});
