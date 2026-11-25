import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, canAccessOffering, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { assessmentSchema, objectId, ploMappingSchema } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { diffFields, type AssessmentSnapshot } from "@/lib/audit/diff";
import { recordAudit } from "@/lib/audit/record";
import { runInTransaction } from "@/lib/transaction";
import { assertPlosAssignedToClass } from "@/lib/obe/plo-scope";
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

/**
 * Edits an assessment. The class's lecturers (and superadmin) may change every field; a faculty
 * head of the department may change only the PLO weights (FR-26, UC-08). Either way the change is
 * recorded in the class history and attainment is recalculated.
 */
export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const { id, aid } = await params;
  objectId.parse(aid);
  const user = await requireApiUser();
  const fullAccess = await canAccessOffering(user, id, "write");
  if (!fullAccess) await assertOfferingAccess(user, id, "mapping");
  const json = await req.json();
  const body = fullAccess ? assessmentSchema.parse(json) : ploMappingSchema.parse(json);
  await assertPlosAssignedToClass(id, body.ploWeights.map((w) => w.plo));
  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    const existing = await Assessment.findOne({ _id: aid, offering: id }, null, opts).lean();
    if (!existing) throw new HttpError(404, "Assessment not found");
    // A mapping-only edit keeps the lecturer's title, max points and share as they are.
    const next = { title: existing.title, maxPoints: existing.maxPoints, gradeWeight: existing.gradeWeight ?? 0, ...body };
    await Assessment.updateOne({ _id: aid, offering: id }, next, { ...opts, runValidators: true });
    const changed = diffFields(snapshot(existing), snapshot(next));
    if (changed) {
      await recordAudit([{ action: "assessment.update", assessment: aid, assessmentTitle: next.title, ...changed }], { offering: id, actor: user }, session);
    }
    await recomputeOffering(id, session);
  });
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
    await recomputeOffering(id, session);
  });
  return NextResponse.json({ ok: true });
});
