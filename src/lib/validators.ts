import { z } from "zod";
import { ROLES, TERMS } from "@/models";

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

export const ploWeightsSchema = z
  .array(z.object({ plo: objectId, weight: z.number().gt(0).max(100) }))
  .refine((ws) => new Set(ws.map((w) => w.plo)).size === ws.length, "Each PLO may appear once per assessment");

export const assessmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  maxPoints: z.number().positive().max(100000),
  gradeWeight: z.number().min(0).max(100).default(0),
  ploWeights: ploWeightsSchema,
});

export const gradesSchema = z.object({
  grades: z
    .array(z.object({ student: objectId, assessment: objectId, score: z.number().min(0).nullable() }))
    .max(20000),
});

export const thresholdSchema = z.object({ threshold: z.number().min(0).max(100) });

export const canvasImportSchema = z.object({
  dryRun: z.boolean().default(false),
  enrollUnenrolled: z.boolean().default(false),
  assessments: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        canvasId: z.string().regex(/^\d+$/).nullable(),
        maxPoints: z.number().positive(),
        gradeWeight: z.number().min(0).max(100).default(0),
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
  year: z.number().int().min(1990).max(2100),
  totalSks: z.number().int().min(0).max(400),
  department: objectId,
  defaultThreshold: z.number().min(0).max(100).default(70),
  isActive: z.boolean().default(true),
});

export const ploSchema = z.object({
  curriculum: objectId,
  number: z.number().int().min(1).max(50),
  shortLabel: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
});

export const courseSchema = z.object({
  curriculum: objectId,
  code: z.string().trim().min(2).max(20).toUpperCase(),
  title: z.string().trim().min(1).max(200),
  sks: z.number().int().min(0).max(24),
  semester: z.number().int().min(1).max(14),
  plos: z.array(objectId),
});

export const offeringSchema = z.object({
  course: objectId,
  academicYear: z.number().int().min(1990).max(2100),
  term: z.enum(TERMS),
  section: z.string().trim().min(1).max(10).default("A"),
  lecturers: z.array(objectId),
  threshold: z.number().min(0).max(100).default(70),
});

export const enrollmentSchema = z.object({ students: z.array(objectId).max(2000) });

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(200),
  roles: z.array(z.enum(ROLES)).min(1),
  password: z.string().min(8).max(200),
  department: objectId.nullable().optional(),
  studentId: z.string().trim().max(40).nullable().optional(),
  cohortYear: z.number().int().min(1990).max(2100).nullable().optional(),
  curriculum: objectId.nullable().optional(),
  advisor: objectId.nullable().optional(),
  staffId: z.string().trim().max(40).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const userUpdateSchema = userCreateSchema.partial().extend({ password: z.string().min(8).max(200).optional() });

export const bulkAdvisorSchema = z.object({ students: z.array(objectId).min(1), advisor: objectId.nullable() });
