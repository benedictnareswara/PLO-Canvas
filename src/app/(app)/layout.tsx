import { requirePageUser, hasRole } from "@/lib/auth/rbac";
import { User } from "@/models";
import { AppShell, type NavSection } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const sections: NavSection[] = [];

  if (hasRole(user, "superadmin")) {
    sections.push({
      title: "Administration",
      items: [
        { href: "/admin", label: "Overview", icon: "layout" },
        { href: "/admin/curriculum", label: "Curriculum & PLOs", icon: "book" },
        { href: "/admin/courses", label: "Courses", icon: "library" },
        { href: "/admin/offerings", label: "Course Offerings", icon: "calendar" },
        { href: "/admin/users", label: "Users & Advisors", icon: "users" },
      ],
    });
  }
  if (hasRole(user, "faculty_head")) {
    sections.push({
      title: "Department Analytics",
      items: [
        { href: "/head", label: "Cohort Overview", icon: "radar" },
        { href: "/head/at-risk", label: "At-Risk Detection", icon: "alert" },
        { href: "/head/courses", label: "Course Attainment", icon: "grid" },
      ],
    });
  }
  if (hasRole(user, "lecturer", "faculty_head")) {
    const advisees = await User.countDocuments({ advisor: user.id, roles: "student" });
    sections.push({
      title: "Teaching",
      items: [
        { href: "/lecturer", label: "My Classes", icon: "library" },
        ...(advisees > 0 ? [{ href: "/lecturer/advisees", label: `My Advisees (${advisees})`, icon: "users" as const }] : []),
      ],
    });
  }
  if (hasRole(user, "student")) {
    sections.push({ title: "Student", items: [{ href: "/student", label: "My Dashboard", icon: "radar" }] });
  }

  return (
    <AppShell user={{ name: user.name, email: user.email, roles: user.roles }} sections={sections}>
      {children}
    </AppShell>
  );
}
