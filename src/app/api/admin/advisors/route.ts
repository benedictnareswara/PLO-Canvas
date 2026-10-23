import { NextResponse } from "next/server";
import { apiHandler, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { bulkAdvisorSchema } from "@/lib/validators";
import { User } from "@/models";

/** Bulk-assign (or clear) the Academic Advisor (Dosen Wali) of several students. */
export const POST = apiHandler(async (req) => {
  await requireApiUser("superadmin");
  const { students, advisor } = bulkAdvisorSchema.parse(await req.json());
  if (advisor) {
    const lecturer = await User.findById(advisor).select("roles").lean();
    if (!lecturer || !lecturer.roles.some((r) => r === "lecturer" || r === "faculty_head")) {
      throw new HttpError(400, "Advisor must be a lecturer");
    }
  }
  const res = await User.updateMany(
    { _id: { $in: students }, roles: "student" },
    advisor ? { advisor } : { $unset: { advisor: 1 } },
  );
  return NextResponse.json({ ok: true, updated: res.modifiedCount });
});
