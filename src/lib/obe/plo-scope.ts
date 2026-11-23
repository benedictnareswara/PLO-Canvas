import "server-only";
import type { ClientSession } from "mongoose";
import { HttpError } from "@/lib/auth/rbac";
import { Course, CourseOffering, Plo } from "@/models";

/** Refuses PLO ids that are not PLOs of the class's curriculum (a mapping can't point elsewhere). */
export async function assertPlosInCurriculum(offeringId: string, ploIds: string[], session?: ClientSession) {
  const unique = [...new Set(ploIds)];
  if (!unique.length) return;
  const opts = session ? { session } : {};
  const offering = await CourseOffering.findById(offeringId, "course", opts).lean();
  const course = offering ? await Course.findById(offering.course, "curriculum", opts).lean() : null;
  if (!course) throw new HttpError(404, "Class not found");
  const valid = await Plo.countDocuments({ _id: { $in: unique }, curriculum: course.curriculum }, opts);
  if (valid !== unique.length) throw new HttpError(400, "One or more PLOs do not belong to this course's curriculum");
}
