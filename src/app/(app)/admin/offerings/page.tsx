import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadCourses, loadOfferings, loadUsers } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { OfferingsAdmin } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Course Offerings" };

export default async function OfferingsPage() {
  await requirePageUser("superadmin");
  const [{ offerings, roster }, courses, users] = await Promise.all([loadOfferings(), loadCourses(), loadUsers()]);
  return (
    <>
      <PageHeader title="Course Offerings" description="Classes per academic year and term, assigned lecturers and enrolled students." />
      <OfferingsAdmin offerings={offerings} roster={roster} courses={courses} users={users} />
    </>
  );
}
