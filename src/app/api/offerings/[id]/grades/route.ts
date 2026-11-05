import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { gradesSchema } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { MAX_SCORE_FACTOR } from "@/lib/gradebook/parse-score";
import { diffGrades } from "@/lib/audit/diff";
import { recordAudit } from "@/lib/audit/record";
import { runInTransaction } from "@/lib/transaction";
import { Assessment, Enrollment, Grade, Types } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

class ConflictError extends Error {
  constructor(public conflicts: { student: string; assessment: string; current: number | null }[]) {
    super("conflict");
  }
}

/**
 * Bulk save from the gradebook. `score: null` clears a grade. Each change may carry `expected`,
 * the value the edit was based on: if any stored value no longer matches (someone else saved in
 * between), nothing is written and the conflicting cells come back as 409 `{ conflicts }`.
 * The conflict check, the writes and the audit entries share one transaction.
 */
export const PUT = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const { grades } = gradesSchema.parse(await req.json());

  const [assessments, enrollments] = await Promise.all([
    Assessment.find({ offering: id }).select("maxPoints title").lean(),
    Enrollment.find({ offering: id }).select("student").lean(),
  ]);
  const byId = new Map(assessments.map((a) => [String(a._id), a]));
  const enrolled = new Set(enrollments.map((e) => String(e.student)));
  for (const g of grades) {
    const a = byId.get(g.assessment);
    if (!a) throw new HttpError(400, "Assessment does not belong to this class");
    if (!enrolled.has(g.student)) throw new HttpError(400, "Student is not enrolled in this class");
    if (g.score !== null && g.score > a.maxPoints * MAX_SCORE_FACTOR) {
      throw new HttpError(400, `Score ${g.score} is far above the assessment's max points`);
    }
  }

  try {
    const { result: saved } = await runInTransaction(async (session) => {
      const stored = await Grade.find({ offering: id }, "assessment student score", session ? { session } : {}).lean();
      const current = new Map(stored.map((g) => [`${g.student}:${g.assessment}`, g.score]));

      const conflicts = grades
        .filter((g) => g.expected !== undefined && (current.get(`${g.student}:${g.assessment}`) ?? null) !== g.expected)
        .map((g) => ({ student: g.student, assessment: g.assessment, current: current.get(`${g.student}:${g.assessment}`) ?? null }));
      if (conflicts.length) throw new ConflictError(conflicts);

      // Only real changes are written and audited.
      const changes = diffGrades(current, grades, (aid) => byId.get(aid)?.title);
      const ops = changes.map((c) => {
        const filter = { assessment: new Types.ObjectId(c.assessment), student: new Types.ObjectId(c.student) };
        return c.action === "grade.clear"
          ? { deleteOne: { filter } }
          : { updateOne: { filter, update: { $set: { score: c.after as number, offering: new Types.ObjectId(id) } }, upsert: true } };
      });
      if (ops.length) await Grade.bulkWrite(ops, session ? { session } : {});
      await recordAudit(changes, { offering: id, actor: user }, session);
      return ops.length;
    });

    const result = saved ? await recomputeOffering(id) : { students: 0, rows: 0 };
    return NextResponse.json({ ok: true, saved, ...result });
  } catch (err) {
    if (err instanceof ConflictError) {
      return NextResponse.json(
        { error: "Some grades were changed by someone else since you loaded this page", conflicts: err.conflicts },
        { status: 409 },
      );
    }
    throw err;
  }
});
