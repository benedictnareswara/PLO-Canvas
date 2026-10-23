import { NextResponse } from "next/server";
import { apiHandler, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { enrollmentSchema, objectId } from "@/lib/validators";
import { recomputeOffering } from "@/lib/obe/recompute";
import { CourseAttainment, CourseOffering, Enrollment, Grade, User } from "@/models";

type Ctx = { params: Promise<{ offeringId: string }> };

/** Replaces the class roster. Removing a student also removes their grades in this class. */
export const PUT = apiHandler<Ctx>(async (req, { params }) => {
  await requireApiUser("superadmin");
  const offeringId = objectId.parse((await params).offeringId);
  if (!(await CourseOffering.exists({ _id: offeringId }))) throw new HttpError(404, "Offering not found");
  const { students } = enrollmentSchema.parse(await req.json());
  const valid = await User.countDocuments({ _id: { $in: students }, roles: "student" });
  if (valid !== new Set(students).size) throw new HttpError(400, "Only students can be enrolled");

  const current = (await Enrollment.find({ offering: offeringId }).select("student").lean()).map((e) => String(e.student));
  const toAdd = students.filter((s) => !current.includes(s));
  const toRemove = current.filter((s) => !students.includes(s));
  if (toAdd.length) await Enrollment.insertMany(toAdd.map((student) => ({ offering: offeringId, student })));
  if (toRemove.length) {
    await Enrollment.deleteMany({ offering: offeringId, student: { $in: toRemove } });
    await Grade.deleteMany({ offering: offeringId, student: { $in: toRemove } });
    await CourseAttainment.deleteMany({ offering: offeringId, student: { $in: toRemove } });
  }
  await recomputeOffering(offeringId);
  return NextResponse.json({ ok: true, added: toAdd.length, removed: toRemove.length });
});
