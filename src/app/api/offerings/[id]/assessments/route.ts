import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, requireApiUser } from "@/lib/auth/rbac";
import { assessmentSchema } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { recordAudit } from "@/lib/audit/record";
import { runInTransaction } from "@/lib/transaction";
import { assertPlosInCurriculum } from "@/lib/obe/plo-scope";
import { Assessment } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const body = assessmentSchema.parse(await req.json());
  await assertPlosInCurriculum(id, body.ploWeights.map((w) => w.plo));
  const { result: assessmentId } = await runInTransaction(async (session) => {
    const [created] = await Assessment.create([{ ...body, offering: id, source: "manual" }], session ? { session } : {});
    await recordAudit(
      [{ action: "assessment.create", assessment: String(created._id), assessmentTitle: body.title, after: body }],
      { offering: id, actor: user },
      session,
    );
    await recomputeOffering(id, session);
    return String(created._id);
  });
  return NextResponse.json({ id: assessmentId }, { status: 201 });
});
