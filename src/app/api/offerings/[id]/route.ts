import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { thresholdSchema } from "@/lib/validators";
import { DEFAULT_THRESHOLD } from "@/lib/obe/engine";
import { recordAudit } from "@/lib/audit/record";
import { runInTransaction } from "@/lib/transaction";
import { CourseOffering } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

/** Threshold override for a class (assigned lecturers and superadmin). */
export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const { threshold } = thresholdSchema.parse(await req.json());
  await runInTransaction(async (session) => {
    const opts = session ? { session } : {};
    const offering = await CourseOffering.findById(id, "threshold", opts).lean();
    if (!offering) throw new HttpError(404, "Class not found");
    const before = offering.threshold ?? DEFAULT_THRESHOLD;
    if (before === threshold) return;
    await CourseOffering.updateOne({ _id: id }, { threshold }, opts);
    await recordAudit([{ action: "threshold.update", before, after: threshold }], { offering: id, actor: user }, session);
  });
  return NextResponse.json({ ok: true, threshold });
});
