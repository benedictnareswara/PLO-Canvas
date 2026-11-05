import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { assessmentSchema, objectId } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { diffFields, type AssessmentSnapshot } from "@/lib/audit/diff";
import { recordAudit } from "@/lib/audit/record";
import { runInTransaction } from "@/lib/transaction";
import { Assessment, Grade } from "@/models";

type Ctx = { params: Promise<{ id: string; aid: string }> };

function snapshot(a: { title: string; maxPoints: number; gradeWeight?: number; ploWeights: { plo: unknown; weight: number }[] }): AssessmentSnapshot {
  return {
    title: a.title,
    maxPoints: a.maxPoints,
    gradeWeight: a.gradeWeight ?? 0,
    ploWeights: a.ploWeights.map((w) => ({ plo: String(w.plo), weight: w.weight })),
  };
}

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const { id, aid } = await params;
  objectId.parse(aid);
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const body = assessmentSchema.parse(await req.json());
  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    const existing = await Assessment.findOne({ _id: aid, offering: id }, null, opts).lean();
    if (!existing) throw new HttpError(404, "Assessment not found");
    await Assessment.updateOne({ _id: aid, offering: id }, body, opts);
    const changed = diffFields(snapshot(existing), snapshot(body));
    if (changed) {
      await recordAudit([{ action: "assessment.update", assessment: aid, assessmentTitle: body.title, ...changed }], { offering: id, actor: user }, session);
    }
  });
  await recomputeOffering(id);
  return NextResponse.json({ ok: true });
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const { id, aid } = await params;
  objectId.parse(aid);
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    const existing = await Assessment.findOne({ _id: aid, offering: id }, null, opts).lean();
    if (!existing) throw new HttpError(404, "Assessment not found");
    const grades = await Grade.countDocuments({ assessment: aid }, opts);
    await Assessment.deleteOne({ _id: aid, offering: id }, opts);
    await Grade.deleteMany({ assessment: aid }, opts);
    await recordAudit(
      [{ action: "assessment.delete", assessment: aid, assessmentTitle: existing.title, before: { ...snapshot(existing), grades } }],
      { offering: id, actor: user },
      session,
    );
  });
  await recomputeOffering(id);
  return NextResponse.json({ ok: true });
});
