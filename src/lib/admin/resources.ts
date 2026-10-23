import "server-only";
import type { Model } from "mongoose";
import type { ZodType } from "zod";
import { HttpError } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { recomputeOffering } from "@/lib/obe/recompute";
import {
  courseSchema,
  curriculumSchema,
  departmentSchema,
  facultySchema,
  offeringSchema,
  ploSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/lib/validators";
import {
  Assessment,
  Course,
  CourseAttainment,
  CourseOffering,
  Curriculum,
  Department,
  Enrollment,
  Faculty,
  Grade,
  Plo,
  User,
} from "@/models";

/**
 * Superadmin-managed resources, served by the generic /api/admin/[resource] routes.
 * Each entry declares validation, optional input transforms, delete guards and
 * side effects (attainment recalculation) so the routes stay uniform.
 */
export interface ResourceConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  create: ZodType;
  update: ZodType;
  transform?: (data: Record<string, unknown>, mode: "create" | "update") => Promise<Record<string, unknown>>;
  beforeDelete?: (id: string) => Promise<void>;
  afterWrite?: (id: string) => Promise<void>;
}

async function recomputeCourseOfferings(courseId: string) {
  const offerings = await CourseOffering.find({ course: courseId }).select("_id").lean();
  for (const o of offerings) await recomputeOffering(o._id);
}

async function blockIfReferenced(checks: [Promise<number>, string][]) {
  for (const [count, message] of checks) if ((await count) > 0) throw new HttpError(409, message);
}

export const RESOURCES: Record<string, ResourceConfig> = {
  faculties: {
    model: Faculty,
    create: facultySchema,
    update: facultySchema.partial(),
    beforeDelete: (id) => blockIfReferenced([[Department.countDocuments({ faculty: id }), "Faculty still has departments"]]),
  },
  departments: {
    model: Department,
    create: departmentSchema,
    update: departmentSchema.partial(),
    beforeDelete: (id) =>
      blockIfReferenced([
        [Curriculum.countDocuments({ department: id }), "Department still has curricula"],
        [User.countDocuments({ department: id }), "Department still has users"],
      ]),
  },
  curricula: {
    model: Curriculum,
    create: curriculumSchema,
    update: curriculumSchema.partial(),
    beforeDelete: (id) =>
      blockIfReferenced([
        [Course.countDocuments({ curriculum: id }), "Curriculum still has courses"],
        [Plo.countDocuments({ curriculum: id }), "Curriculum still has PLOs"],
      ]),
  },
  plos: {
    model: Plo,
    create: ploSchema,
    update: ploSchema.partial(),
    transform: async (data) => (typeof data.number === "number" ? { ...data, code: `PLO ${data.number}` } : data),
    beforeDelete: (id) =>
      blockIfReferenced([
        [Course.countDocuments({ plos: id }), "PLO is mapped to courses"],
        [Assessment.countDocuments({ "ploWeights.plo": id }), "PLO is mapped to assessments"],
      ]),
  },
  courses: {
    model: Course,
    create: courseSchema,
    update: courseSchema.partial(),
    beforeDelete: (id) => blockIfReferenced([[CourseOffering.countDocuments({ course: id }), "Course has offerings; delete them first"]]),
    afterWrite: recomputeCourseOfferings,
  },
  offerings: {
    model: CourseOffering,
    create: offeringSchema,
    update: offeringSchema.partial(),
    beforeDelete: async (id) => {
      // Cascade: an offering owns its enrollments, assessments, grades and attainment rows.
      await Promise.all([
        Enrollment.deleteMany({ offering: id }),
        Assessment.deleteMany({ offering: id }),
        Grade.deleteMany({ offering: id }),
        CourseAttainment.deleteMany({ offering: id }),
      ]);
    },
    afterWrite: (id) => recomputeOffering(id).then(() => undefined),
  },
  users: {
    model: User,
    create: userCreateSchema,
    update: userUpdateSchema,
    transform: async (data) => {
      const { password, ...rest } = data as { password?: string };
      for (const k of ["department", "curriculum", "advisor", "studentId", "cohortYear", "staffId"]) {
        if (rest[k as keyof typeof rest] === "") (rest as Record<string, unknown>)[k] = null;
      }
      return password ? { ...rest, passwordHash: await hashPassword(password) } : rest;
    },
    beforeDelete: (id) =>
      blockIfReferenced([
        [Enrollment.countDocuments({ student: id }), "User has enrollments; deactivate the account instead"],
        [CourseOffering.countDocuments({ lecturers: id }), "User teaches classes; deactivate the account instead"],
      ]),
    afterWrite: async (id) => {
      // Cohort year drives semester numbering, so refresh the student's attainment rows.
      const offerings = await Enrollment.find({ student: id }).distinct("offering");
      for (const o of offerings) await recomputeOffering(o);
      // Clear advisor links that point at a user who is no longer a lecturer.
      const user = await User.findById(id).select("roles").lean();
      if (user && !user.roles.some((r) => r === "lecturer" || r === "faculty_head")) {
        await User.updateMany({ advisor: id }, { $unset: { advisor: 1 } });
      }
    },
  },
};

export function getResource(name: string): ResourceConfig {
  const config = RESOURCES[name];
  if (!config) throw new HttpError(404, `Unknown resource "${name}"`);
  return config;
}
