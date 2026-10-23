import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { gradesSchema } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { Assessment, Enrollment, Grade, Types } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

/** Bulk save from the gradebook grid. `score: null` clears a grade. */
export const PUT = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const { grades } = gradesSchema.parse(await req.json());

  const [assessments, enrollments] = await Promise.all([
    Assessment.find({ offering: id }).select("maxPoints").lean(),
    Enrollment.find({ offering: id }).select("student").lean(),
  ]);
  const maxOf = new Map(assessments.map((a) => [String(a._id), a.maxPoints]));
  const enrolled = new Set(enrollments.map((e) => String(e.student)));

  const ops = grades.map((g) => {
    if (!maxOf.has(g.assessment)) throw new HttpError(400, "Assessment does not belong to this class");
    if (!enrolled.has(g.student)) throw new HttpError(400, "Student is not enrolled in this class");
    if (g.score !== null && g.score > maxOf.get(g.assessment)! * 1.5) {
      throw new HttpError(400, `Score ${g.score} is far above the assessment's max points`);
    }
    const filter = { assessment: new Types.ObjectId(g.assessment), student: new Types.ObjectId(g.student) };
    return g.score === null
      ? { deleteOne: { filter } }
      : { updateOne: { filter, update: { $set: { score: g.score, offering: new Types.ObjectId(id) } }, upsert: true } };
  });
  if (ops.length) await Grade.bulkWrite(ops);
  const result = await recomputeOffering(id);
  return NextResponse.json({ ok: true, saved: ops.length, ...result });
});
