import mongoose, { Schema, model, models, type Model, Types } from "mongoose";

const { ObjectId } = Schema.Types;

function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T>) ?? model<T>(name, schema);
}

/* ------------------------------ Institution ------------------------------ */

const facultySchema = new Schema<FacultyDoc>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const departmentSchema = new Schema<DepartmentDoc>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    faculty: { type: ObjectId, ref: "Faculty", required: true },
  },
  { timestamps: true },
);

const curriculumSchema = new Schema<CurriculumDoc>(
  {
    name: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    totalSks: { type: Number, required: true, min: 0 },
    department: { type: ObjectId, ref: "Department", required: true },
    defaultThreshold: { type: Number, default: 70, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const ploSchema = new Schema<PloDoc>(
  {
    curriculum: { type: ObjectId, ref: "Curriculum", required: true },
    number: { type: Number, required: true, min: 1 },
    code: { type: String, required: true },
    shortLabel: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true },
);
ploSchema.index({ curriculum: 1, number: 1 }, { unique: true });

const courseSchema = new Schema<CourseDoc>(
  {
    curriculum: { type: ObjectId, ref: "Curriculum", required: true },
    code: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    sks: { type: Number, required: true, min: 0 },
    semester: { type: Number, required: true, min: 1, max: 14 },
    plos: [{ type: ObjectId, ref: "Plo" }],
  },
  { timestamps: true },
);
courseSchema.index({ curriculum: 1, code: 1 }, { unique: true });

/* --------------------------------- People -------------------------------- */

export const ROLES = ["superadmin", "faculty_head", "lecturer", "student"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    roles: { type: [{ type: String, enum: ROLES }], required: true },
    department: { type: ObjectId, ref: "Department" },
    // Student-only fields
    studentId: { type: String, trim: true, sparse: true, unique: true },
    cohortYear: { type: Number },
    curriculum: { type: ObjectId, ref: "Curriculum" },
    advisor: { type: ObjectId, ref: "User" },
    // Staff-only fields
    staffId: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
userSchema.index({ advisor: 1 });
userSchema.index({ cohortYear: 1 });

/* -------------------------------- Teaching ------------------------------- */

export const TERMS = ["odd", "even"] as const;
export type Term = (typeof TERMS)[number];

const offeringSchema = new Schema<OfferingDoc>(
  {
    course: { type: ObjectId, ref: "Course", required: true },
    // Start year of the academic year, e.g. 2025 for "2025/2026".
    academicYear: { type: Number, required: true },
    term: { type: String, enum: TERMS, required: true },
    section: { type: String, default: "A" },
    lecturers: [{ type: ObjectId, ref: "User" }],
    threshold: { type: Number, default: 70, min: 0, max: 100 },
  },
  { timestamps: true },
);
offeringSchema.index({ course: 1, academicYear: 1, term: 1, section: 1 }, { unique: true });
offeringSchema.index({ lecturers: 1 });

const enrollmentSchema = new Schema<EnrollmentDoc>(
  {
    offering: { type: ObjectId, ref: "CourseOffering", required: true },
    student: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
enrollmentSchema.index({ offering: 1, student: 1 }, { unique: true });
enrollmentSchema.index({ student: 1 });

const ploWeightSchema = new Schema<{ plo: Types.ObjectId; weight: number }>(
  {
    plo: { type: ObjectId, ref: "Plo", required: true },
    weight: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const assessmentSchema = new Schema<AssessmentDoc>(
  {
    offering: { type: ObjectId, ref: "CourseOffering", required: true },
    title: { type: String, required: true, trim: true },
    maxPoints: { type: Number, required: true, min: 0.0001 },
    // Share of the overall course grade (any positive scale; normalized when computing).
    gradeWeight: { type: Number, default: 0, min: 0 },
    canvasId: { type: String },
    ploWeights: { type: [ploWeightSchema], default: [] },
    source: { type: String, enum: ["manual", "canvas"], default: "manual" },
  },
  { timestamps: true },
);
assessmentSchema.index(
  { offering: 1, canvasId: 1 },
  { unique: true, partialFilterExpression: { canvasId: { $type: "string" } } },
);

const gradeSchema = new Schema<GradeDoc>(
  {
    assessment: { type: ObjectId, ref: "Assessment", required: true },
    offering: { type: ObjectId, ref: "CourseOffering", required: true },
    student: { type: ObjectId, ref: "User", required: true },
    score: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);
gradeSchema.index({ assessment: 1, student: 1 }, { unique: true });
gradeSchema.index({ offering: 1, student: 1 });

// Materialized course-level PLO attainment (PLO_c,k per student), rebuilt by recomputeOffering().
const attainmentSchema = new Schema<AttainmentDoc>(
  {
    offering: { type: ObjectId, ref: "CourseOffering", required: true },
    course: { type: ObjectId, ref: "Course", required: true },
    student: { type: ObjectId, ref: "User", required: true },
    plo: { type: ObjectId, ref: "Plo", required: true },
    ploNumber: { type: Number, required: true },
    value: { type: Number, required: true },
    sks: { type: Number, required: true },
    academicYear: { type: Number, required: true },
    term: { type: String, enum: TERMS, required: true },
    studentSemester: { type: Number, required: true },
  },
  { timestamps: true },
);
attainmentSchema.index({ student: 1 });
attainmentSchema.index({ offering: 1 });

type Id = Types.ObjectId;
interface Timestamps {
  _id: Id;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FacultyDoc extends Timestamps {
  code: string;
  name: string;
}
export interface DepartmentDoc extends Timestamps {
  code: string;
  name: string;
  faculty: Id;
}
export interface CurriculumDoc extends Timestamps {
  name: string;
  year: number;
  totalSks: number;
  department: Id;
  defaultThreshold: number;
  isActive: boolean;
}
export interface PloDoc extends Timestamps {
  curriculum: Id;
  number: number;
  code: string;
  shortLabel: string;
  description: string;
}
export interface CourseDoc extends Timestamps {
  curriculum: Id;
  code: string;
  title: string;
  sks: number;
  semester: number;
  plos: Id[];
}
export interface UserDoc extends Timestamps {
  email: string;
  passwordHash: string;
  name: string;
  roles: Role[];
  department?: Id | null;
  studentId?: string | null;
  cohortYear?: number | null;
  curriculum?: Id | null;
  advisor?: Id | null;
  staffId?: string | null;
  isActive: boolean;
}
export interface OfferingDoc extends Timestamps {
  course: Id;
  academicYear: number;
  term: Term;
  section: string;
  lecturers: Id[];
  threshold: number;
}
export interface EnrollmentDoc extends Timestamps {
  offering: Id;
  student: Id;
}
export interface AssessmentDoc extends Timestamps {
  offering: Id;
  title: string;
  maxPoints: number;
  gradeWeight: number;
  canvasId?: string | null;
  ploWeights: { plo: Id; weight: number }[];
  source: "manual" | "canvas";
}
export interface GradeDoc extends Timestamps {
  assessment: Id;
  offering: Id;
  student: Id;
  score: number;
}
export interface AttainmentDoc extends Timestamps {
  offering: Id;
  course: Id;
  student: Id;
  plo: Id;
  ploNumber: number;
  value: number;
  sks: number;
  academicYear: number;
  term: Term;
  studentSemester: number;
}

export const Faculty = getModel<FacultyDoc>("Faculty", facultySchema);
export const Department = getModel<DepartmentDoc>("Department", departmentSchema);
export const Curriculum = getModel<CurriculumDoc>("Curriculum", curriculumSchema);
export const Plo = getModel<PloDoc>("Plo", ploSchema);
export const Course = getModel<CourseDoc>("Course", courseSchema);
export const User = getModel<UserDoc>("User", userSchema);
export const CourseOffering = getModel<OfferingDoc>("CourseOffering", offeringSchema);
export const Enrollment = getModel<EnrollmentDoc>("Enrollment", enrollmentSchema);
export const Assessment = getModel<AssessmentDoc>("Assessment", assessmentSchema);
export const Grade = getModel<GradeDoc>("Grade", gradeSchema);
export const CourseAttainment = getModel<AttainmentDoc>("CourseAttainment", attainmentSchema);

export { mongoose, Types };
