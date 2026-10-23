import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/rbac";
import { Card, CardBody, PageHeader, Stat } from "@/components/ui";
import { Course, CourseOffering, Curriculum, Grade, Plo, User } from "@/models";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminHome() {
  await requirePageUser("superadmin");
  const [curricula, plos, courses, offerings, students, lecturers, unadvised, grades] = await Promise.all([
    Curriculum.countDocuments(),
    Plo.countDocuments(),
    Course.countDocuments(),
    CourseOffering.countDocuments(),
    User.countDocuments({ roles: "student" }),
    User.countDocuments({ roles: { $in: ["lecturer", "faculty_head"] } }),
    User.countDocuments({ roles: "student", advisor: null }),
    Grade.countDocuments(),
  ]);
  const links = [
    { href: "/admin/curriculum", title: "Curriculum & PLOs", text: "Faculties, departments, curricula and their Program Learning Outcomes." },
    { href: "/admin/courses", title: "Courses", text: "Course catalogue with SKS, recommended semester and PLO mapping." },
    { href: "/admin/offerings", title: "Course offerings", text: "Classes per academic year and term, lecturer assignment and rosters." },
    { href: "/admin/users", title: "Users & advisors", text: "Accounts, roles and Academic Advisor (Dosen Wali) assignment." },
  ];
  return (
    <>
      <PageHeader title="System Administration" description="Configure the institutional structure, curriculum and users of the OBE gradebook." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Curricula / PLOs" value={`${curricula} / ${plos}`} />
        <Stat label="Courses / offerings" value={`${courses} / ${offerings}`} />
        <Stat label="Students / lecturers" value={`${students} / ${lecturers}`} />
        <Stat label="Students without advisor" value={unadvised} tone={unadvised ? "risk" : "ok"} hint={`${grades} grade records`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="h-full transition-colors hover:border-brand/40">
              <CardBody>
                <div className="font-semibold text-brand">{l.title}</div>
                <p className="mt-1 text-sm text-muted">{l.text}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
