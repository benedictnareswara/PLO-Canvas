import { NextResponse } from "next/server";
import { apiHandler, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { enrollmentSchema, objectId } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { runInTransaction } from "@/lib/transaction";
import { CourseAttainment, CourseOffering, Enrollment, Grade, User } from "@/models";

type Ctx = { params: Promise<{ offeringId: string }> };

/** Replaces the class roster. Removing a student also removes their grades in this class. */
export const PUT = apiHandler<Ctx>(async (req, { params }) => {
  await requireApiUser("superadmin");
  const offeringId = objectId.parse((await params).offeringId);
  if (!(await CourseOffering.exists({ _id: offeringId }))) throw new HttpError(404, "Offering not found");
  // The same id twice would be inserted twice and hit the unique index.
  const students = [...new Set(enrollmentSchema.parse(await req.json()).students)];
  const valid = await User.countDocuments({ _id: { $in: students }, roles: "student" });
  if (valid !== students.length) throw new HttpError(400, "Only students can be enrolled");

  // The roster, the removed students' grades and the recalculation land together, or not at all.
  const { result } = await runInTransaction(async (session) => {
    const current = (await Enrollment.find({ offering: offeringId }, "student", { session }).lean()).map((e) => String(e.student));
    const toAdd = students.filter((s) => !current.includes(s));
    const toRemove = current.filter((s) => !students.includes(s));
    if (toAdd.length) await Enrollment.insertMany(toAdd.map((student) => ({ offering: offeringId, student })), { session });
    if (toRemove.length) {
      await Enrollment.deleteMany({ offering: offeringId, student: { $in: toRemove } }, { session });
      await Grade.deleteMany({ offering: offeringId, student: { $in: toRemove } }, { session });
      await CourseAttainment.deleteMany({ offering: offeringId, student: { $in: toRemove } }, { session });
    }
    await recomputeOffering(offeringId, session);
    return { added: toAdd.length, removed: toRemove.length };
  });
  return NextResponse.json({ ok: true, ...result });
});
