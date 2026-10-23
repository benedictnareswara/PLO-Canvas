import type { ClientSession } from "mongoose";
import { Assessment, Course, CourseAttainment, CourseOffering, Enrollment, Grade, Plo, User, Types } from "@/models";
import { coursePloAttainment, type AssessmentInput } from "./engine";
import { studentSemester } from "./semesters";

/**
 * Rebuilds the materialized course-level PLO attainment (PLO_c,k) of every
 * enrolled student in one offering. Call after any grade/assessment change.
 */
export async function recomputeOffering(offeringId: string | Types.ObjectId, session?: ClientSession) {
  const opts = session ? { session } : {};
  const offering = await CourseOffering.findById(offeringId, null, opts).lean();
  if (!offering) return { students: 0, rows: 0 };
  const course = await Course.findById(offering.course, null, opts).lean();
  if (!course) return { students: 0, rows: 0 };

  const [assessments, enrollments, grades] = await Promise.all([
    Assessment.find({ offering: offering._id }, null, opts).lean(),
    Enrollment.find({ offering: offering._id }, null, opts).lean(),
    Grade.find({ offering: offering._id }, null, opts).lean(),
  ]);

  const ploIds = [...new Set(assessments.flatMap((a) => a.ploWeights.map((w) => String(w.plo))))];
  const plos = await Plo.find({ _id: { $in: ploIds } }, null, opts).lean();
  const ploNumber = new Map(plos.map((p) => [String(p._id), p.number]));

  const students = await User.find({ _id: { $in: enrollments.map((e) => e.student) } }, "cohortYear", opts).lean();
  const cohortOf = new Map(students.map((s) => [String(s._id), s.cohortYear ?? undefined]));

  const inputs: AssessmentInput<string>[] = assessments.map((a) => ({
    id: String(a._id),
    maxPoints: a.maxPoints,
    gradeWeight: a.gradeWeight ?? 0,
    ploWeights: a.ploWeights.map((w) => ({ plo: String(w.plo), weight: w.weight })),
  }));

  const scoresByStudent = new Map<string, Map<string, number>>();
  for (const g of grades) {
    const sid = String(g.student);
    if (!scoresByStudent.has(sid)) scoresByStudent.set(sid, new Map());
    scoresByStudent.get(sid)!.set(String(g.assessment), g.score);
  }

  const rows = [];
  for (const e of enrollments) {
    const sid = String(e.student);
    const attainment = coursePloAttainment(inputs, scoresByStudent.get(sid) ?? new Map());
    const cohort = cohortOf.get(sid);
    const semester = cohort ? studentSemester(cohort, offering.academicYear, offering.term) : course.semester;
    for (const [plo, value] of attainment) {
      const number = ploNumber.get(plo);
      if (number === undefined) continue;
      rows.push({
        offering: offering._id,
        course: course._id,
        student: e.student,
        plo: new Types.ObjectId(plo),
        ploNumber: number,
        value,
        sks: course.sks,
        academicYear: offering.academicYear,
        term: offering.term,
        studentSemester: semester,
      });
    }
  }

  await CourseAttainment.deleteMany({ offering: offering._id }, opts);
  if (rows.length) await CourseAttainment.insertMany(rows, opts);
  return { students: enrollments.length, rows: rows.length };
}
