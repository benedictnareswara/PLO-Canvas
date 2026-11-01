import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, CircleAlert, Library, Users } from "lucide-react";
import { requirePageUser } from "@/lib/auth/rbac";
import { Card, CardHeader, PageHeader, SummaryStrip } from "@/components/ui";
import { Course, CourseOffering, Curriculum, Grade, Plo, User } from "@/models";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

export default async function AdminHome() {
  await requirePageUser("superadmin");
  const t = await getTranslations("admin.overview");
  const [curricula, plos, courses, offerings, students, lecturers, grades, noAdvisor, noCurriculum, unmappedCourses, unassignedOfferings, curriculaIds] =
    await Promise.all([
      Curriculum.countDocuments(),
      Plo.countDocuments(),
      Course.countDocuments(),
      CourseOffering.countDocuments(),
      User.countDocuments({ roles: "student" }),
      User.countDocuments({ roles: { $in: ["lecturer", "faculty_head"] } }),
      Grade.countDocuments(),
      User.countDocuments({ roles: "student", isActive: { $ne: false }, advisor: null }),
      User.countDocuments({ roles: "student", isActive: { $ne: false }, curriculum: null }),
      Course.countDocuments({ plos: { $size: 0 } }),
      CourseOffering.countDocuments({ lecturers: { $size: 0 } }),
      Curriculum.find().select("_id").lean(),
    ]);
  const withPlos = await Plo.distinct("curriculum");
  const curriculaWithoutPlos = curriculaIds.filter((c) => !withPlos.some((p) => String(p) === String(c._id))).length;

  // Setup gaps that make PLO attainment wrong or invisible, each linking to where it's fixed.
  const checklist = [
    { key: "advisor", count: noAdvisor, href: "/admin/users?role=student&advisor=none", icon: Users },
    { key: "curriculum", count: noCurriculum, href: "/admin/users?role=student", icon: Users },
    { key: "unmapped", count: unmappedCourses, href: "/admin/courses?unmapped=1", icon: Library },
    { key: "unassigned", count: unassignedOfferings, href: "/admin/offerings?unassigned=1", icon: CalendarDays },
    { key: "noPlos", count: curriculaWithoutPlos, href: "/admin/curriculum", icon: BookOpen },
  ];
  const open = checklist.filter((c) => c.count > 0);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SummaryStrip
        items={[
          { label: t("curricula"), value: `${curricula} / ${plos}`, hint: t("curriculaHint") },
          { label: t("courses"), value: `${courses} / ${offerings}`, hint: t("coursesHint") },
          { label: t("people"), value: `${students} / ${lecturers}`, hint: t("peopleHint") },
          { label: t("grades"), value: grades.toLocaleString("en"), hint: t("gradesHint") },
        ]}
      />
      <Card>
        <CardHeader
          title={t("checklistTitle")}
          description={open.length ? t("checklistOpen", { count: open.length }) : t("checklistDone")}
        />
        <ul className="divide-y divide-border">
          {checklist.map((c) => {
            const done = c.count === 0;
            const Icon = done ? CheckCircle2 : CircleAlert;
            return (
              <li key={c.key}>
                <Link
                  href={c.href}
                  className="group flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                >
                  <Icon className={done ? "size-5 shrink-0 text-ok" : "size-5 shrink-0 text-warn"} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={done ? "text-muted" : "font-medium"}>{t(`items.${c.key}`, { count: c.count })}</span>
                    <span className="sr-only"> {done ? t("done") : t("todo")}</span>
                  </span>
                  {!done && (
                    <span className="hidden items-center gap-1 text-xs font-medium text-brand sm:flex">
                      {t("fix")} <ArrowRight className="size-3.5 transition-transform duration-(--dur-1) group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
