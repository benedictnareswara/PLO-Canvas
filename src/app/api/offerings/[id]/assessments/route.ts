import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, requireApiUser } from "@/lib/auth/rbac";
import { assessmentSchema } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { Assessment } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const body = assessmentSchema.parse(await req.json());
  const assessment = await Assessment.create({ ...body, offering: id, source: "manual" });
  await recomputeOffering(id);
  return NextResponse.json({ id: String(assessment._id) }, { status: 201 });
});
