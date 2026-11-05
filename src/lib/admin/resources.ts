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
  /**
   * What depends on a record. `blocking` dependents prevent deletion (the message says why);
   * the others are removed with it. Shown in the delete confirmation before anything happens.
   */
  dependents?: (id: string) => Promise<Dependent[]>;
  beforeDelete?: (id: string) => Promise<void>;
  afterWrite?: (id: string) => Promise<void>;
}

export interface Dependent {
  /** Message key under admin.dependents (client side). */
  key: string;
  count: number;
  blocking: boolean;
  /** Server message when this dependent blocks a delete. */
  message?: string;
}

const dep = async (key: string, count: Promise<number>, blocking: boolean, message?: string): Promise<Dependent> => ({ key, count: await count, blocking, message });

/** Refuses a delete while any blocking dependent exists. */
export async function assertDeletable(config: ResourceConfig, id: string) {
  const blocker = (await config.dependents?.(id))?.find((d) => d.blocking && d.count > 0);
  if (blocker) throw new HttpError(409, blocker.message ?? "This record is still in use");
}

async function recomputeCourseOfferings(courseId: string) {
  const offerings = await CourseOffering.find({ course: courseId }).select("_id").lean();
  for (const o of offerings) await recomputeOffering(o._id);
}


export const RESOURCES: Record<string, ResourceConfig> = {
  faculties: {
    model: Faculty,
    create: facultySchema,
    update: facultySchema.partial(),
    dependents: async (id) => [await dep("departments", Department.countDocuments({ faculty: id }), true, "Faculty still has departments")],
  },
  departments: {
    model: Department,
    create: departmentSchema,
    update: departmentSchema.partial(),
    dependents: (id) =>
      Promise.all([
        dep("curricula", Curriculum.countDocuments({ department: id }), true, "Department still has curricula"),
        dep("users", User.countDocuments({ department: id }), true, "Department still has users"),
      ]),
  },
  curricula: {
    model: Curriculum,
    create: curriculumSchema,
    update: curriculumSchema.partial(),
    dependents: (id) =>
      Promise.all([
        dep("courses", Course.countDocuments({ curriculum: id }), true, "Curriculum still has courses"),
        dep("plos", Plo.countDocuments({ curriculum: id }), true, "Curriculum still has PLOs"),
      ]),
  },
  plos: {
    model: Plo,
    create: ploSchema,
    update: ploSchema.partial(),
    transform: async (data) => (typeof data.number === "number" ? { ...data, code: `PLO ${data.number}` } : data),
    dependents: (id) =>
      Promise.all([
        dep("courseMappings", Course.countDocuments({ plos: id }), true, "PLO is mapped to courses"),
        dep("assessmentMappings", Assessment.countDocuments({ "ploWeights.plo": id }), true, "PLO is mapped to assessments"),
      ]),
  },
  courses: {
    model: Course,
    create: courseSchema,
    update: courseSchema.partial(),
    dependents: async (id) => [await dep("offerings", CourseOffering.countDocuments({ course: id }), true, "Course has offerings; delete them first")],
    afterWrite: recomputeCourseOfferings,
  },
  offerings: {
    model: CourseOffering,
    create: offeringSchema,
    update: offeringSchema.partial(),
    dependents: (id) =>
      Promise.all([
        dep("enrollments", Enrollment.countDocuments({ offering: id }), false),
        dep("assessments", Assessment.countDocuments({ offering: id }), false),
        dep("grades", Grade.countDocuments({ offering: id }), false),
      ]),
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
    dependents: (id) =>
      Promise.all([
        dep("userEnrollments", Enrollment.countDocuments({ student: id }), true, "User has enrollments; deactivate the account instead"),
        dep("classesTaught", CourseOffering.countDocuments({ lecturers: id }), true, "User teaches classes; deactivate the account instead"),
        dep("advisees", User.countDocuments({ advisor: id }), false),
      ]),
    // Advisees of a deleted lecturer lose the dangling advisor link.
    beforeDelete: async (id) => {
      await User.updateMany({ advisor: id }, { $unset: { advisor: 1 } });
    },
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
