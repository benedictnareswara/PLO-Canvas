import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canViewStudent, getCurrentUser, requirePageUser } from "@/lib/auth/rbac";
import { getStudentProfile } from "@/lib/obe/queries";
import { atRiskPlos, cumulativeForStudent, rowsToSums, toPloValues } from "@/lib/obe/aggregate";
import { isAtRisk } from "@/lib/obe/engine";
import { formatPct } from "@/components/AtRiskBadge";
import { ReportRadar } from "@/components/reports/ReportRadar";
import { ReportSection, ReportShell, ReportTable } from "@/components/reports/ReportShell";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("reports.student");
  // Only name the student to someone allowed to see them.
  const user = await getCurrentUser();
  const data = user && (await canViewStudent(user, id)) ? await getStudentProfile(id) : null;
  return { title: data ? t("metaTitle", { name: data.student.name }) : t("title") };
}

/** Student PLO transcript: cumulative attainment per PLO and the course record behind it. */
export default async function StudentReport({ params }: Props) {
  const { id } = await params;
  const user = await requirePageUser();
  if (!(await canViewStudent(user, id))) notFound();
  const data = await getStudentProfile(id);
  if (!data) notFound();
  const t = await getTranslations("reports");
  const { student, plos, threshold, rows, courses } = data;
  const values = toPloValues(cumulativeForStudent(rowsToSums(rows), student.id, "all"), plos);
  const risky = atRiskPlos(values, threshold);
  const backHref = user.id === student.id ? "/student" : `/students/${student.id}`;

  return (
    <ReportShell
      title={t("student.title")}
      subtitle={`${student.name} · NIM ${student.studentId ?? "—"}${student.cohortYear ? ` · ${t("classOf", { year: student.cohortYear })}` : ""}${student.advisorName ? ` · ${t("student.advisor", { name: student.advisorName })}` : ""}`}
      backHref={backHref}
      generatedBy={user.name}
    >
      <ReportSection title={t("student.summary")}>
        <p className="text-sm">
          {risky.length
            ? t("student.summaryRisk", { count: risky.length, list: risky.map((n) => `PLO ${n}`).join(", "), target: threshold })
            : t("student.summaryOk", { target: threshold })}
        </p>
      </ReportSection>

      <ReportSection title={t("student.radar")}>
        <ReportRadar plos={plos} threshold={threshold} series={[{ key: "s", label: student.name, values }]} />
      </ReportSection>

      <ReportSection title={t("student.outcomes")}>
        <ReportTable
          head={
            <tr>
              <th>PLO</th>
              <th>{t("outcome")}</th>
              <th className="text-right">{t("attainment")}</th>
              <th>{t("status")}</th>
            </tr>
          }
        >
          {plos.map((p) => {
            const v = values[p.number];
            return (
              <tr key={p.id}>
                <td className="font-medium whitespace-nowrap">{p.code}</td>
                <td>{p.shortLabel}</td>
                <td className="text-right tabular">{formatPct(v)}</td>
                <td>{v === null ? t("noEvidence") : isAtRisk(v, threshold) ? <strong>{t("atRisk")}</strong> : t("met")}</td>
              </tr>
            );
          })}
        </ReportTable>
      </ReportSection>

      <ReportSection title={t("student.courses")} keepTogether={false}>
        <ReportTable
          head={
            <tr>
              <th>{t("course")}</th>
              <th className="text-right">{t("semester")}</th>
              <th className="text-right">SKS</th>
              <th className="text-right">{t("grade")}</th>
              <th>{t("letter")}</th>
              <th>{t("ploValues")}</th>
            </tr>
          }
        >
          {courses.map((c) => (
            <tr key={c.offeringId}>
              <td>
                <span className="font-medium">{c.code}</span> {c.title}
                <div className="text-[0.625rem] text-muted">{c.period}</div>
              </td>
              <td className="text-right tabular">{c.semester}</td>
              <td className="text-right tabular">{c.sks}</td>
              <td className="text-right tabular">{c.grade === null ? t("inProgress") : formatPct(c.grade)}</td>
              <td>{c.grade === null ? "—" : c.letter}</td>
              <td className="tabular">
                {Object.entries(c.plo)
                  .filter(([, v]) => v !== null)
                  .map(([n, v]) => `PLO ${n}: ${(v as number).toFixed(1)}`)
                  .join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </ReportTable>
      </ReportSection>
    </ReportShell>
  );
}
