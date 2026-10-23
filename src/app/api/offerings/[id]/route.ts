import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, requireApiUser } from "@/lib/auth/rbac";
import { thresholdSchema } from "@/lib/validators";
import { CourseOffering } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

/** Threshold override for a class (assigned lecturers and superadmin). */
export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const { threshold } = thresholdSchema.parse(await req.json());
  await CourseOffering.updateOne({ _id: id }, { threshold });
  return NextResponse.json({ ok: true, threshold });
});
