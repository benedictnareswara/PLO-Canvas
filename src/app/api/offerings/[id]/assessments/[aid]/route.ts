import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { assessmentSchema, objectId } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { Assessment, Grade } from "@/models";

type Ctx = { params: Promise<{ id: string; aid: string }> };

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const { id, aid } = await params;
  objectId.parse(aid);
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const body = assessmentSchema.parse(await req.json());
  const res = await Assessment.updateOne({ _id: aid, offering: id }, body);
  if (!res.matchedCount) throw new HttpError(404, "Assessment not found");
  await recomputeOffering(id);
  return NextResponse.json({ ok: true });
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const { id, aid } = await params;
  objectId.parse(aid);
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const res = await Assessment.deleteOne({ _id: aid, offering: id });
  if (!res.deletedCount) throw new HttpError(404, "Assessment not found");
  await Grade.deleteMany({ assessment: aid });
  await recomputeOffering(id);
  return NextResponse.json({ ok: true });
});
