import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canAccessOffering, getCurrentUser, requirePageUser } from "@/lib/auth/rbac";
import { getOfferingDetail } from "@/lib/obe/queries";
import { cohortAggregate, isAtRisk } from "@/lib/obe/engine";
import { formatPct } from "@/components/AtRiskBadge";
import { ReportRadar } from "@/components/reports/ReportRadar";
import { ReportSection, ReportShell, ReportTable } from "@/components/reports/ReportShell";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("reports.offering");
  const user = await getCurrentUser();
  const detail = user && (await canAccessOffering(user, id, "read")) ? await getOfferingDetail(id) : null;
  return { title: detail ? t("metaTitle", { code: detail.code }) : t("title") };
}

/** Class report: class PLO attainment, its distribution, each student's values and the assessment design. */
export default async function OfferingReport({ params }: Props) {
  const { id } = await params;
  const user = await requirePageUser("lecturer", "faculty_head", "superadmin");
  if (!(await canAccessOffering(user, id, "read"))) notFound();
  const detail = await getOfferingDetail(id);
  if (!detail) notFound();
  const t = await getTranslations("reports");
  const { plos, students, attainment, threshold } = detail;

  const stats = cohortAggregate(
    students.map(
      (s) =>
        new Map(
          Object.entries(attainment[s.id] ?? {})
            .filter(([, v]) => v !== null)
            .map(([k, v]) => [Number(k), v as number]),
        ),
    ),
  );
  const evidenced = plos.filter((p) => stats.has(p.number));
  const mean = Object.fromEntries(plos.map((p) => [p.number, stats.get(p.number)?.mean ?? null]));
  const ploCode = new Map(plos.map((p) => [p.id, p.code]));

  return (
    <ReportShell
      title={t("offering.title")}
      subtitle={`${detail.code} · ${detail.title} · ${detail.period} · ${detail.sks} SKS · ${detail.lecturers.map((l) => l.name).join(", ")} · ${t("target", { value: threshold })}`}
      backHref={`/lecturer/offerings/${detail.id}`}
      generatedBy={user.name}
    >
      <ReportSection title={t("offering.summary")}>
        <p className="text-sm">
          {t("offering.summaryText", {
            students: students.length,
            measured: evidenced.length,
            mapped: detail.coursePloNumbers.length,
            below: evidenced.filter((p) => isAtRisk(stats.get(p.number)!.mean, threshold)).length,
          })}
        </p>
      </ReportSection>

      {evidenced.length > 0 && (
        <ReportSection title={t("offering.radar")}>
          <ReportRadar plos={plos} threshold={threshold} series={[{ key: "mean", label: t("offering.classMean"), values: mean }]} />
        </ReportSection>
      )}

      <ReportSection title={t("offering.distribution")}>
        <ReportTable
          head={
            <tr>
              <th>PLO</th>
              <th>{t("outcome")}</th>
              <th className="text-right">{t("mean")}</th>
              <th className="text-right">{t("range")}</th>
              <th className="text-right">{t("belowTarget")}</th>
            </tr>
          }
        >
          {evidenced.map((p) => {
            const s = stats.get(p.number)!;
            const below = students.filter((st) => isAtRisk(attainment[st.id]?.[p.number], threshold)).length;
            return (
              <tr key={p.id}>
                <td className="font-medium">{p.code}</td>
                <td>{p.shortLabel}</td>
                <td className="text-right tabular">
                  {formatPct(s.mean)}
                  {isAtRisk(s.mean, threshold) && <strong>*</strong>}
                </td>
                <td className="text-right tabular">
                  {s.min.toFixed(1)}–{s.max.toFixed(1)}
                </td>
                <td className="text-right tabular">
                  {below}/{s.n}
                </td>
              </tr>
            );
          })}
        </ReportTable>
        <p className="mt-1 text-[0.625rem] text-muted">{t("offering.flagNote", { target: threshold })}</p>
      </ReportSection>

      <ReportSection title={t("offering.students")} keepTogether={false}>
        <ReportTable
          head={
            <tr>
              <th>{t("studentCol")}</th>
              {evidenced.map((p) => (
                <th key={p.id} className="text-right">
                  {p.number}
                </th>
              ))}
              <th className="text-right">{t("grade")}</th>
            </tr>
          }
        >
          {students.map((s) => (
            <tr key={s.id}>
              <td>
                {s.name}
                <div className="text-[0.625rem] text-muted">NIM {s.studentId ?? "—"}</div>
              </td>
              {evidenced.map((p) => {
                const v = attainment[s.id]?.[p.number] ?? null;
                return (
                  <td key={p.id} className="text-right tabular">
                    {v === null ? "—" : isAtRisk(v, threshold) ? <strong>{v.toFixed(1)}*</strong> : v.toFixed(1)}
                  </td>
                );
              })}
              <td className="text-right whitespace-nowrap tabular">
                {formatPct(detail.courseGrades[s.id]?.pct)} {detail.courseGrades[s.id]?.letter}
              </td>
            </tr>
          ))}
        </ReportTable>
        <p className="mt-1 text-[0.625rem] text-muted">{t("offering.starNote", { target: threshold })}</p>
      </ReportSection>

      <ReportSection title={t("offering.assessments")}>
        <ReportTable
          head={
            <tr>
              <th>{t("assessment")}</th>
              <th className="text-right">{t("maxPoints")}</th>
              <th className="text-right">{t("gradeWeight")}</th>
              <th>{t("ploWeights")}</th>
            </tr>
          }
        >
          {detail.assessments.map((a) => (
            <tr key={a.id}>
              <td>{a.title}</td>
              <td className="text-right tabular">{a.maxPoints}</td>
              <td className="text-right tabular">{a.gradeWeight}%</td>
              <td>{[...a.ploWeights].sort((x, y) => x.number - y.number).map((w) => `${ploCode.get(w.plo) ?? `PLO ${w.number}`} ${w.weight}%`).join(", ") || "—"}</td>
            </tr>
          ))}
        </ReportTable>
      </ReportSection>
    </ReportShell>
  );
}
