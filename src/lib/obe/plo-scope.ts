import "server-only";
import type { ClientSession } from "mongoose";
import { HttpError } from "@/lib/auth/rbac";
import { Course, CourseOffering } from "@/models";

/**
 * Refuses PLO ids that the admin has not assigned to the course (Course.plos). Lecturers map
 * assessments only to the course's own PLOs; the admin decides which those are.
 */
export async function assertPlosAssignedToCourse(courseId: unknown, ploIds: string[], session?: ClientSession) {
  const unique = [...new Set(ploIds.map(String))];
  if (!unique.length) return;
  const course = await Course.findById(courseId, "plos", session ? { session } : {}).lean();
  if (!course) throw new HttpError(404, "Course not found");
  if (!course.plos.length) {
    throw new HttpError(400, "The admin has not assigned any PLOs to this course yet, so assessments can't be mapped to PLOs");
  }
  const assigned = new Set(course.plos.map(String));
  if (unique.some((id) => !assigned.has(id))) {
    throw new HttpError(400, "Assessments can only be mapped to the PLOs the admin assigned to this course");
  }
}

/** Same check, starting from a class (offering) id. */
export async function assertPlosAssignedToClass(offeringId: string, ploIds: string[], session?: ClientSession) {
  if (!new Set(ploIds).size) return;
  const offering = await CourseOffering.findById(offeringId, "course", session ? { session } : {}).lean();
  if (!offering) throw new HttpError(404, "Class not found");
  await assertPlosAssignedToCourse(offering.course, ploIds, session);
}
