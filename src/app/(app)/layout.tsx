import { getTranslations } from "next-intl/server";
import { requirePageUser, hasRole } from "@/lib/auth/rbac";
import { User } from "@/models";
import { AppShell, type NavSection } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const t = await getTranslations("nav");
  const sections: NavSection[] = [];

  if (hasRole(user, "superadmin")) {
    sections.push({
      title: t("administration"),
      items: [
        { href: "/admin", label: t("overview"), icon: "layout" },
        { href: "/admin/curriculum", label: t("curriculum"), icon: "book" },
        { href: "/admin/courses", label: t("courses"), icon: "library" },
        { href: "/admin/offerings", label: t("offerings"), icon: "calendar" },
        { href: "/admin/users", label: t("users"), icon: "users" },
      ],
    });
  }
  if (hasRole(user, "faculty_head")) {
    sections.push({
      title: t("analytics"),
      items: [
        { href: "/head", label: t("cohortOverview"), icon: "radar" },
        { href: "/head/at-risk", label: t("atRisk"), icon: "alert" },
        { href: "/head/courses", label: t("courseAttainment"), icon: "grid" },
      ],
    });
  }
  if (hasRole(user, "lecturer", "faculty_head")) {
    const advisees = await User.countDocuments({ advisor: user.id, roles: "student" });
    sections.push({
      title: t("teaching"),
      items: [
        { href: "/lecturer", label: t("myClasses"), icon: "library" },
        ...(advisees > 0 ? [{ href: "/lecturer/advisees", label: t("myAdvisees"), icon: "users" as const, count: advisees }] : []),
      ],
    });
  }
  if (hasRole(user, "student")) {
    sections.push({ title: t("student"), items: [{ href: "/student", label: t("myDashboard"), icon: "radar" }] });
  }

  return (
    <AppShell user={{ name: user.name, email: user.email, roles: user.roles }} sections={sections}>
      {children}
    </AppShell>
  );
}
