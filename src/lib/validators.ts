import { z } from "zod";
import { ROLES, TERMS } from "@/models";
import { NIM_PATTERN, RANGES } from "@/lib/ranges";
import { LOCALES } from "@/i18n/config";
import { DEFAULT_GRADE_SCALE, parseGradeScale } from "@/lib/obe/engine";

const { percent, maxPoints, year, sks, totalSks, semester, ploNumber } = RANGES;
/** A percentage from 0 to 100. */
const pct = () => z.number().min(percent.min).max(percent.max);
const calendarYear = () => z.number().int().min(year.min).max(year.max);

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

/** UC-05 / FR-08: the PLO weights of one assessment split it across PLOs and must total 100%. */
export const ploWeightsTotal100 = (ws: { weight: number }[]) => Math.abs(ws.reduce((s, w) => s + w.weight, 0) - 100) < 0.01;

export const ploWeightsSchema = z
  .array(z.object({ plo: objectId, weight: z.number().gt(0).max(percent.max) }))
  .refine((ws) => new Set(ws.map((w) => w.plo)).size === ws.length, "Each PLO may appear once per assessment")
  .refine(ploWeightsTotal100, "PLO weights of an assessment must total 100%");

export const assessmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  maxPoints: z.number().min(maxPoints.min).max(maxPoints.max),
  gradeWeight: pct().default(0),
  ploWeights: ploWeightsSchema,
});

/** FR-26 / UC-08: a faculty head reviewing a class may change only the PLO weights. */
export const ploMappingSchema = z.object({ ploWeights: ploWeightsSchema });

export const gradesSchema = z.object({
  grades: z
    .array(
      z.object({
        student: objectId,
        assessment: objectId,
        score: z.number().min(0).nullable(),
        // The value the client's edit was based on (null = was blank). Omitted by older clients.
        expected: z.number().min(0).nullable().optional(),
      }),
    )
    .max(20000),
});

export const thresholdSchema = z.object({ threshold: pct() });

export const canvasImportSchema = z.object({
  dryRun: z.boolean().default(false),
  enrollUnenrolled: z.boolean().default(false),
  /**
   * Canvas "EX" (excused) cells are kept apart from blanks. By default they are skipped like a
   * blank, so they never overwrite a grade (NFR-03); with this set, the lecturer has confirmed in
   * the dry run that grades of excused cells should be removed (logged as grade.clear).
   */
  clearExcused: z.boolean().default(false),
  assessments: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        canvasId: z.string().regex(/^\d+$/).nullable(),
        maxPoints: z.number().min(maxPoints.min).max(maxPoints.max),
        gradeWeight: pct().default(0),
        ploWeights: ploWeightsSchema,
      }),
    )
    .max(300),
  students: z
    .array(
      z.object({
        name: z.string(),
        canvasUserId: z.string().default(""),
        sisUserId: z.string().default(""),
        sisLoginId: z.string().default(""),
        scores: z.record(z.string(), z.number().min(0).nullable()),
        /** Keys of the cells marked EX (excused) in Canvas. */
        excused: z.array(z.string()).max(300).default([]),
      }),
    )
    .max(5000),
});
export type CanvasImportPayload = z.infer<typeof canvasImportSchema>;

/* ------------------------------ Admin schemas ----------------------------- */

export const facultySchema = z.object({ code: z.string().trim().min(1).max(20), name: z.string().trim().min(1).max(200) });

export const departmentSchema = facultySchema.extend({ faculty: objectId });

export const curriculumSchema = z.object({
  name: z.string().trim().min(1).max(200),
  year: calendarYear(),
  totalSks: z.number().int().min(totalSks.min).max(totalSks.max),
  department: objectId,
  defaultThreshold: pct().default(70),
  gradeScale: z
    .string()
    .trim()
    .max(300)
    .refine((s) => parseGradeScale(s) !== null, {
      message: 'Write each letter with its minimum %, highest first and ending at 0, like "A 90, B 80, C 70, D 60, F 0"',
    })
    .default(DEFAULT_GRADE_SCALE),
  isActive: z.boolean().default(true),
});

export const ploSchema = z.object({
  curriculum: objectId,
  number: z.number().int().min(ploNumber.min).max(ploNumber.max),
  shortLabel: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
});

export const courseSchema = z.object({
  curriculum: objectId,
  code: z.string().trim().min(2).max(20).toUpperCase(),
  title: z.string().trim().min(1).max(200),
  sks: z.number().int().min(sks.min).max(sks.max),
  semester: z.number().int().min(semester.min).max(semester.max),
  plos: z.array(objectId),
});

export const offeringSchema = z.object({
  course: objectId,
  academicYear: calendarYear(),
  term: z.enum(TERMS),
  section: z.string().trim().min(1).max(10).default("A"),
  lecturers: z.array(objectId),
  // Left out on create: the class then takes its curriculum's default target (UC-02 step 4).
  threshold: pct().nullable().optional(),
});

export const enrollmentSchema = z.object({ students: z.array(objectId).max(2000) });

const userFields = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(200),
  roles: z.array(z.enum(ROLES)).min(1),
  password: z.string().min(8).max(200),
  department: objectId.nullable().optional(),
  // Empty is allowed here (it means "no NIM", e.g. staff); a student must have one (see below).
  studentId: z
    .string()
    .trim()
    .refine((v) => v === "" || NIM_PATTERN.test(v), "A student number (NIM) may contain digits only (up to 20)")
    .nullable()
    .optional(),
  cohortYear: calendarYear().nullable().optional(),
  curriculum: objectId.nullable().optional(),
  advisor: objectId.nullable().optional(),
  staffId: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().optional(),
});

/** UC-01: a student account needs a student number (NIM), an entry year and a curriculum. */
export const userCreateSchema = userFields.superRefine((u, ctx) => {
  if (!u.roles.includes("student")) return;
  if (!u.studentId?.trim()) ctx.addIssue({ code: "custom", path: ["studentId"], message: "A student needs a student number (NIM)" });
  if (u.cohortYear === null || u.cohortYear === undefined) ctx.addIssue({ code: "custom", path: ["cohortYear"], message: "A student needs an entry year" });
  if (!u.curriculum) ctx.addIssue({ code: "custom", path: ["curriculum"], message: "A student needs a curriculum" });
});

export const userUpdateSchema = userFields.partial().extend({ password: z.string().min(8).max(200).optional() });

/** The signed-in user's own settings (PATCH /api/me). */
export const preferencesSchema = z.object({ locale: z.enum(LOCALES) }).strict();
export const passwordChangeSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) })
  .strict()
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password different from the current one" });

export const bulkAdvisorSchema = z.object({ students: z.array(objectId).min(1), advisor: objectId.nullable() });
