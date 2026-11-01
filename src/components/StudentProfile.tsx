"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Lightbulb } from "lucide-react";
import { PloRadar } from "@/components/charts/PloRadarLazy";
import { PloCell, formatPct } from "@/components/AtRiskBadge";
import { PeriodPicker, useAnalyticsFilters } from "@/components/analytics/filters";
import { Badge, Card, CardBody, CardHeader, Meter, SummaryStrip, cn } from "@/components/ui";
import { atRiskPlos, cumulativeForStudent, rowsToSums, toPloValues } from "@/lib/obe/aggregate";
import { isAtRisk } from "@/lib/obe/engine";
import { inPeriod } from "@/lib/obe/semesters";
import type { StudentCourseView, StudentProfileData } from "@/lib/obe/queries";

/**
 * One student's outcomes. Laid out for phones first: summary, period, radar, the outcome list
 * (each PLO against the target, with guidance on where at-risk PLOs are assessed), then courses
 * that expand to their assessments.
 */
export function StudentProfile({ data, audience }: { data: StudentProfileData; audience: "self" | "staff" }) {
  const t = useTranslations("profile");
  const { student, plos, threshold, rows, courses } = data;
  const { period, setPeriod } = useAnalyticsFilters(threshold);

  const sums = useMemo(() => rowsToSums(rows), [rows]);
  const values = useMemo(() => toPloValues(cumulativeForStudent(sums, student.id, period), plos), [sums, student.id, period, plos]);
  const risky = atRiskPlos(values, threshold);
  const visibleCourses = courses.filter((c) => inPeriod(c.semester, period));
  const graded = courses.filter((c) => c.grade !== null);
  const completedSks = graded.reduce((s, c) => s + c.sks, 0);
  const evidenced = Object.values(values).filter((v) => v !== null).length;
  const ploCode = (n: number) => plos.find((p) => p.number === n)?.code ?? `PLO ${n}`;

  // Where each at-risk PLO is assessed: the courses in this period that produced a value for it.
  const guidance = risky.map((n) => ({
    plo: n,
    courses: visibleCourses.filter((c) => c.plo[n] !== null && c.plo[n] !== undefined).map((c) => c.code),
  }));

  return (
    <div className="space-y-6">
      <SummaryStrip
        className="mb-0"
        items={[
          { label: t("cohort"), value: student.cohortYear ? t("classOf", { year: student.cohortYear }) : "—", hint: `NIM ${student.studentId ?? "—"}` },
          { label: t("courses"), value: graded.length, hint: t("sksAssessed", { sks: completedSks }) },
          { label: t("plosEvidenced"), value: `${evidenced}/${plos.length}` },
          {
            label: t("plosAtRisk"),
            value: risky.length,
            tone: risky.length ? "risk" : "ok",
            hint: risky.length ? risky.map(ploCode).join(", ") : t("allMet", { target: threshold }),
          },
        ]}
      />

      <PeriodPicker value={period} onChange={setPeriod} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title={t("chartTitle")} description={t("chartDescription", { target: threshold })} />
          <CardBody>
            <PloRadar plos={plos} threshold={threshold} series={[{ key: "student", label: student.name, values }]} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("outcomesTitle")} description={t("outcomesDescription", { target: threshold })} />
          {guidance.length > 0 && (
            <div className="border-b border-border bg-warn-soft/60 px-5 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warn">
                <Lightbulb className="size-4" aria-hidden /> {audience === "self" ? t("guidanceTitleSelf") : t("guidanceTitleStaff")}
              </p>
              <ul className="space-y-1 text-sm">
                {guidance.map((g) => (
                  <li key={g.plo}>
                    {g.courses.length
                      ? t("guidance", { plo: ploCode(g.plo), courses: g.courses.join(", "), count: g.courses.length })
                      : t("guidanceNoCourse", { plo: ploCode(g.plo) })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="divide-y divide-border">
            {plos.map((p) => {
              const v = values[p.number];
              const risk = isAtRisk(v, threshold);
              return (
                <li key={p.id} className="px-5 py-3">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium">{p.code}</span> <span className="text-muted">· {p.shortLabel}</span>
                    </div>
                    <span className={cn("text-sm tabular", risk ? "font-semibold text-risk" : v === null ? "text-muted" : "font-medium")}>
                      {v === null ? t("noEvidence") : formatPct(v)}
                      {risk && <span className="sr-only"> {t("atRisk")}</span>}
                    </span>
                  </div>
                  <Meter value={v} target={threshold} tone={v === null ? "brand" : risk ? "risk" : "ok"} label={`${p.code}: ${v === null ? t("noEvidence") : formatPct(v)}`} />
                  <p className="mt-1 line-clamp-2 text-xs text-muted" title={p.description}>
                    {p.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("coursesTitle")} description={student.advisorName ? t("advisor", { name: student.advisorName }) : undefined} />
        {visibleCourses.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">{t("noCourses")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleCourses.map((c) => (
              <li key={c.offeringId} className="[contain-intrinsic-size:auto_4.5rem] [content-visibility:auto]">
                <CourseCard course={c} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CourseCard({ course }: { course: StudentCourseView }) {
  const t = useTranslations("profile");
  const mapped = Object.entries(course.plo)
    .filter(([, v]) => v !== null)
    .map(([n, v]) => ({ number: Number(n), value: v as number }));
  return (
    <details className="ui-collapse group/c">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-(--dur-2) group-open/c:rotate-180 motion-reduce:transition-none" aria-hidden />
        <div className="min-w-44 flex-1">
          <div className="text-sm font-medium">
            {course.code} · {course.title}
          </div>
          <div className="text-xs text-muted">{t("courseMeta", { semester: course.semester, period: course.period, sks: course.sks })}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {mapped.map((p) => (
            <span key={p.number} className="flex items-center gap-1 text-xs">
              <span className="text-muted">PLO {p.number}</span>
              <PloCell value={p.value} threshold={course.threshold} />
            </span>
          ))}
        </div>
        <div className="ml-auto text-right">
          {course.grade === null ? (
            <Badge>{t("inProgress")}</Badge>
          ) : (
            <span className="text-sm font-semibold tabular">
              {formatPct(course.grade)} <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">{course.letter}</span>
            </span>
          )}
        </div>
      </summary>
      <div className="px-5 pb-4 sm:pl-13">
        {course.assessments.length === 0 ? (
          <p className="text-sm text-muted">{t("noAssessments")}</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {course.assessments.map((a) => (
              <li key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-3 py-2 text-sm sm:grid-cols-[1fr_7rem_4rem_auto]">
                <span className="font-medium">{a.title}</span>
                <span className="text-right tabular">{a.score === null ? <span className="text-muted">{t("notGraded")}</span> : `${a.score} / ${a.maxPoints}`}</span>
                <span className="text-xs text-muted tabular sm:text-right sm:text-sm sm:text-foreground">
                  {formatPct(a.pct)}
                  {a.gradeWeight ? <span className="sm:hidden"> · {t("weight", { value: a.gradeWeight })}</span> : null}
                </span>
                <span className="flex flex-wrap justify-end gap-1">
                  {a.plos.map((p) => (
                    <Badge key={p.number} tone="info">
                      PLO {p.number} · {p.weight}%
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
