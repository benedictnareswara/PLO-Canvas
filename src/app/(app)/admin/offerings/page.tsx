import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/rbac";
import { loadCourses, loadOfferings, loadUsers } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui";
import { OfferingsAdmin } from "@/components/admin/AdminViews";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("offerings") };
}

export default async function OfferingsPage() {
  await requirePageUser("superadmin");
  const t = await getTranslations("admin.pages");
  const [{ offerings, roster }, courses, users] = await Promise.all([loadOfferings(), loadCourses(), loadUsers()]);
  return (
    <>
      <PageHeader title={t("offeringsTitle")} description={t("offeringsDescription")} />
      <OfferingsAdmin offerings={offerings} roster={roster} courses={courses} users={users} />
    </>
  );
}
