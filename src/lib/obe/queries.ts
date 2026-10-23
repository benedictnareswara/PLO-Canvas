import "server-only";
import {
  Assessment,
  Course,
  CourseAttainment,
  CourseOffering,
  Curriculum,
  Enrollment,
  Grade,
  Plo,
  User,
  Types,
} from "@/models";
import { DEFAULT_THRESHOLD, courseGrade, cumulativePloAttainment, letterGrade, scorePercentage } from "./engine";
import { offeringPeriodLabel, studentSemester } from "./semesters";
import type { AttainmentRow, PloInfo, PloValues, StudentSummary } from "./types";

const oid = (id: string) => new Types.ObjectId(id);

export async function getCurriculumForDepartment(departmentId: string | null) {
  const filter = departmentId ? { department: oid(departmentId), isActive: true } : { isActive: true };
  return (await Curriculum.findOne(filter).sort({ year: -1 }).lean()) ?? (await Curriculum.findOne().lean());
}

export async function getPlos(curriculumId: string | Types.ObjectId): Promise<PloInfo[]> {
  const plos = await Plo.find({ curriculum: curriculumId }).sort({ number: 1 }).lean();
  return plos.map((p) => ({
    id: String(p._id),
    number: p.number,
    code: p.code,
    shortLabel: p.shortLabel,
    description: p.description,
  }));
}

export function mapToPloValues(m: Map<number, number>, plos: PloInfo[]): PloValues {
  return Object.fromEntries(plos.map((p) => [p.number, m.get(p.number) ?? null]));
}

export async function getAttainmentRows(studentIds: Types.ObjectId[]): Promise<AttainmentRow[]> {
  const rows = await CourseAttainment.find({ student: { $in: studentIds } }).lean();
  const courses = await Course.find({ _id: { $in: [...new Set(rows.map((r) => String(r.course)))] } })
    .select("code")
    .lean();
  const codeOf = new Map(courses.map((c) => [String(c._id), c.code]));
  return rows.map((r) => ({
    student: String(r.student),
    offering: String(r.offering),
    courseCode: codeOf.get(String(r.course)) ?? "",
    ploNumber: r.ploNumber,
    value: r.value,
    sks: r.sks,
    studentSemester: r.studentSemester,
  }));
}

export function cumulativeFromRows(rows: AttainmentRow[]): Map<number, number> {
  return cumulativePloAttainment(rows.map((r) => ({ plo: r.ploNumber, value: r.value, sks: r.sks })));
}

function toStudentSummary(u: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  studentId?: string | null;
  cohortYear?: number | null;
}): StudentSummary {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    studentId: u.studentId ?? null,
    cohortYear: u.cohortYear ?? null,
  };
}

/* ----------------------------- Student profile ---------------------------- */

export interface StudentCourseView {
  offeringId: string;
  code: string;
  title: string;
  sks: number;
  period: string;
  semester: number;
  threshold: number;
  grade: number | null;
  letter: string;
  assessments: {
    id: string;
    title: string;
    maxPoints: number;
    score: number | null;
    pct: number | null;
    gradeWeight: number;
    plos: { number: number; weight: number }[];
  }[];
  plo: PloValues;
}

export interface StudentProfileData {
  student: StudentSummary;
  plos: PloInfo[];
  threshold: number;
  rows: AttainmentRow[];
  courses: StudentCourseView[];
}

export async function getStudentProfile(studentId: string): Promise<StudentProfileData | null> {
  const student = await User.findById(studentId).lean();
  if (!student) return null;
  const advisor = student.advisor ? await User.findById(student.advisor).select("name").lean() : null;
  const curriculum = student.curriculum
    ? await Curriculum.findById(student.curriculum).lean()
    : await getCurriculumForDepartment(student.department ? String(student.department) : null);
  const plos = curriculum ? await getPlos(curriculum._id) : [];
  const ploNumberById = new Map(plos.map((p) => [p.id, p.number]));
  const threshold = curriculum?.defaultThreshold ?? DEFAULT_THRESHOLD;

  const enrollments = await Enrollment.find({ student: student._id }).lean();
  const offerings = await CourseOffering.find({ _id: { $in: enrollments.map((e) => e.offering) } }).lean();
  const courses = await Course.find({ _id: { $in: offerings.map((o) => o.course) } }).lean();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const [assessments, grades, rows] = await Promise.all([
    Assessment.find({ offering: { $in: offerings.map((o) => o._id) } }).sort({ createdAt: 1 }).lean(),
    Grade.find({ student: student._id }).lean(),
    getAttainmentRows([student._id]),
  ]);
  const scoreOf = new Map(grades.map((g) => [String(g.assessment), g.score]));

  const courseViews: StudentCourseView[] = offerings.map((o) => {
    const course = courseById.get(String(o.course))!;
    const own = assessments.filter((a) => String(a.offering) === String(o._id));
    const inputs = own.map((a) => ({
      id: String(a._id),
      maxPoints: a.maxPoints,
      gradeWeight: a.gradeWeight ?? 0,
      ploWeights: [],
    }));
    const grade = courseGrade(inputs, Object.fromEntries(own.map((a) => [String(a._id), scoreOf.get(String(a._id))])));
    const ploMap = new Map(
      rows.filter((r) => r.offering === String(o._id)).map((r) => [r.ploNumber, r.value] as [number, number]),
    );
    return {
      offeringId: String(o._id),
      code: course.code,
      title: course.title,
      sks: course.sks,
      period: offeringPeriodLabel(o.academicYear, o.term),
      semester: student.cohortYear ? studentSemester(student.cohortYear, o.academicYear, o.term) : course.semester,
      threshold: o.threshold ?? DEFAULT_THRESHOLD,
      grade,
      letter: letterGrade(grade),
      assessments: own.map((a) => {
        const score = scoreOf.get(String(a._id));
        return {
          id: String(a._id),
          title: a.title,
          maxPoints: a.maxPoints,
          score: score ?? null,
          pct: score === undefined ? null : scorePercentage(score, a.maxPoints),
          gradeWeight: a.gradeWeight ?? 0,
          plos: a.ploWeights
            .map((w) => ({ number: ploNumberById.get(String(w.plo)) ?? 0, weight: w.weight }))
            .sort((x, y) => x.number - y.number),
        };
      }),
      plo: mapToPloValues(ploMap, plos),
    };
  });
  courseViews.sort((a, b) => b.semester - a.semester || a.code.localeCompare(b.code));

  return {
    student: { ...toStudentSummary(student), advisorName: advisor?.name ?? null },
    plos,
    threshold,
    rows,
    courses: courseViews,
  };
}

/* ------------------------------ Offering view ----------------------------- */

export interface OfferingAssessmentView {
  id: string;
  title: string;
  maxPoints: number;
  gradeWeight: number;
  canvasId: string | null;
  source: string;
  ploWeights: { plo: string; number: number; weight: number }[];
}

export interface OfferingDetail {
  id: string;
  code: string;
  title: string;
  sks: number;
  period: string;
  academicYear: number;
  term: string;
  threshold: number;
  lecturers: { id: string; name: string }[];
  coursePloNumbers: number[];
  plos: PloInfo[];
  assessments: OfferingAssessmentView[];
  students: StudentSummary[];
  grades: Record<string, Record<string, number>>;
  attainment: Record<string, PloValues>;
  courseGrades: Record<string, { pct: number | null; letter: string }>;
}

export async function getOfferingDetail(offeringId: string): Promise<OfferingDetail | null> {
  const offering = await CourseOffering.findById(offeringId).lean();
  if (!offering) return null;
  const course = await Course.findById(offering.course).lean();
  if (!course) return null;
  const plos = await getPlos(course.curriculum);
  const ploNumberById = new Map(plos.map((p) => [p.id, p.number]));

  const [lecturers, assessments, enrollments, grades, attainment] = await Promise.all([
    User.find({ _id: { $in: offering.lecturers } }).select("name").lean(),
    Assessment.find({ offering: offering._id }).sort({ createdAt: 1 }).lean(),
    Enrollment.find({ offering: offering._id }).lean(),
    Grade.find({ offering: offering._id }).lean(),
    CourseAttainment.find({ offering: offering._id }).lean(),
  ]);
  const students = await User.find({ _id: { $in: enrollments.map((e) => e.student) } })
    .sort({ name: 1 })
    .lean();

  const gradeMatrix: Record<string, Record<string, number>> = {};
  for (const g of grades) {
    (gradeMatrix[String(g.student)] ??= {})[String(g.assessment)] = g.score;
  }

  const attainmentByStudent: Record<string, PloValues> = {};
  for (const s of students) attainmentByStudent[String(s._id)] = mapToPloValues(new Map(), plos);
  for (const r of attainment) {
    const sid = String(r.student);
    if (attainmentByStudent[sid]) attainmentByStudent[sid][r.ploNumber] = r.value;
  }

  const inputs = assessments.map((a) => ({
    id: String(a._id),
    maxPoints: a.maxPoints,
    gradeWeight: a.gradeWeight ?? 0,
    ploWeights: [],
  }));
  const courseGrades: OfferingDetail["courseGrades"] = {};
  for (const s of students) {
    const pct = courseGrade(inputs, gradeMatrix[String(s._id)] ?? {});
    courseGrades[String(s._id)] = { pct, letter: letterGrade(pct) };
  }

  return {
    id: String(offering._id),
    code: course.code,
    title: course.title,
    sks: course.sks,
    period: offeringPeriodLabel(offering.academicYear, offering.term),
    academicYear: offering.academicYear,
    term: offering.term,
    threshold: offering.threshold ?? DEFAULT_THRESHOLD,
    lecturers: lecturers.map((l) => ({ id: String(l._id), name: l.name })),
    coursePloNumbers: course.plos.map((p) => ploNumberById.get(String(p)) ?? 0).filter(Boolean).sort((a, b) => a - b),
    plos,
    assessments: assessments.map((a) => ({
      id: String(a._id),
      title: a.title,
      maxPoints: a.maxPoints,
      gradeWeight: a.gradeWeight ?? 0,
      canvasId: a.canvasId ?? null,
      source: a.source ?? "manual",
      ploWeights: a.ploWeights.map((w) => ({
        plo: String(w.plo),
        number: ploNumberById.get(String(w.plo)) ?? 0,
        weight: w.weight,
      })),
    })),
    students: students.map(toStudentSummary),
    grades: gradeMatrix,
    attainment: attainmentByStudent,
    courseGrades,
  };
}

/** Class mean PLO attainment per offering, computed from the materialized rows. */
async function classMeans(offeringIds: Types.ObjectId[]): Promise<Map<string, Map<number, number>>> {
  const agg = await CourseAttainment.aggregate<{ _id: { o: Types.ObjectId; p: number }; mean: number }>([
    { $match: { offering: { $in: offeringIds } } },
    { $group: { _id: { o: "$offering", p: "$ploNumber" }, mean: { $avg: "$value" } } },
  ]);
  const out = new Map<string, Map<number, number>>();
  for (const { _id, mean } of agg) {
    const key = String(_id.o);
    if (!out.has(key)) out.set(key, new Map());
    out.get(key)!.set(_id.p, mean);
  }
  return out;
}

export interface OfferingListItem {
  id: string;
  code: string;
  title: string;
  sks: number;
  academicYear: number;
  term: string;
  period: string;
  threshold: number;
  lecturers: string[];
  studentCount: number;
  assessmentCount: number;
  plo: PloValues;
}

export async function listOfferings(filter: { lecturer?: string; departmentId?: string | null }): Promise<{
  offerings: OfferingListItem[];
  plos: PloInfo[];
}> {
  const curriculum = await getCurriculumForDepartment(filter.departmentId ?? null);
  const plos = curriculum ? await getPlos(curriculum._id) : [];
  const courseFilter = filter.departmentId
    ? { curriculum: { $in: await Curriculum.find({ department: oid(filter.departmentId) }).distinct("_id") } }
    : {};
  const courses = await Course.find(courseFilter).lean();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  const query: Record<string, unknown> = { course: { $in: courses.map((c) => c._id) } };
  if (filter.lecturer) query.lecturers = oid(filter.lecturer);
  const offerings = await CourseOffering.find(query).sort({ academicYear: -1, term: -1 }).lean();
  const ids = offerings.map((o) => o._id);

  const [enrollCounts, assessmentCounts, means, lecturers] = await Promise.all([
    Enrollment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { offering: { $in: ids } } },
      { $group: { _id: "$offering", n: { $sum: 1 } } },
    ]),
    Assessment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { offering: { $in: ids } } },
      { $group: { _id: "$offering", n: { $sum: 1 } } },
    ]),
    classMeans(ids),
    User.find({ _id: { $in: offerings.flatMap((o) => o.lecturers) } }).select("name").lean(),
  ]);
  const nEnroll = new Map(enrollCounts.map((x) => [String(x._id), x.n]));
  const nAssess = new Map(assessmentCounts.map((x) => [String(x._id), x.n]));
  const lecturerName = new Map(lecturers.map((l) => [String(l._id), l.name]));

  return {
    plos,
    offerings: offerings
      .map((o) => {
        const course = courseById.get(String(o.course))!;
        return {
          id: String(o._id),
          code: course.code,
          title: course.title,
          sks: course.sks,
          academicYear: o.academicYear,
          term: o.term,
          period: offeringPeriodLabel(o.academicYear, o.term),
          threshold: o.threshold ?? DEFAULT_THRESHOLD,
          lecturers: o.lecturers.map((l) => lecturerName.get(String(l)) ?? "—"),
          studentCount: nEnroll.get(String(o._id)) ?? 0,
          assessmentCount: nAssess.get(String(o._id)) ?? 0,
          plo: mapToPloValues(means.get(String(o._id)) ?? new Map(), plos),
        };
      })
      .sort((a, b) => b.academicYear - a.academicYear || b.term.localeCompare(a.term) || a.code.localeCompare(b.code)),
  };
}

/* ------------------------- Advisees & cohorts (raw) ------------------------ */

export interface StudentsWithRows {
  students: StudentSummary[];
  rows: AttainmentRow[];
  plos: PloInfo[];
  threshold: number;
}

export async function getStudentsWithRows(filter: { advisor?: string; departmentId?: string | null }): Promise<StudentsWithRows> {
  const query: Record<string, unknown> = { roles: "student" };
  if (filter.advisor) query.advisor = oid(filter.advisor);
  if (filter.departmentId) query.department = oid(filter.departmentId);
  const students = await User.find(query).sort({ cohortYear: 1, name: 1 }).lean();
  const curriculum = await getCurriculumForDepartment(filter.departmentId ?? null);
  const plos = curriculum ? await getPlos(curriculum._id) : [];
  return {
    students: students.map(toStudentSummary),
    rows: await getAttainmentRows(students.map((s) => s._id)),
    plos,
    threshold: curriculum?.defaultThreshold ?? DEFAULT_THRESHOLD,
  };
}
