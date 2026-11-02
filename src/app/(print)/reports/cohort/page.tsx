import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/rbac";
import { getStudentsWithRows } from "@/lib/obe/queries";
import { atRiskPlos, summarizeCohorts } from "@/lib/obe/aggregate";
import { isAtRisk } from "@/lib/obe/engine";
import { PERIOD_FILTERS, type PeriodFilter } from "@/lib/obe/semesters";
import { formatPct } from "@/components/AtRiskBadge";
import { ReportRadar } from "@/components/reports/ReportRadar";
import { ReportSection, ReportShell, ReportTable } from "@/components/reports/ReportShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports.cohort");
  return { title: t("title") };
}

/** Department cohort report: cohort means per PLO and the students who need intervention. */
export default async function CohortReport({ searchParams }: { searchParams: Promise<{ period?: string; threshold?: string }> }) {
  const user = await requirePageUser("faculty_head", "superadmin");
  const sp = await searchParams;
  const t = await getTranslations("reports");
  const tp = await getTranslations("period");
  const data = await getStudentsWithRows({ departmentId: user.department });
  const period: PeriodFilter = PERIOD_FILTERS.some((p) => p.value === sp.period) ? (sp.period as PeriodFilter) : "all";
  const asked = Number(sp.threshold);
  const threshold = Number.isFinite(asked) && asked >= 0 && asked <= 100 && sp.threshold ? asked : data.threshold;
  const cohorts = summarizeCohorts(data.students, data.sums, data.plos, threshold, period);
  const atRisk = cohorts.flatMap((c) => c.students).filter((s) => s.atRisk.length).sort((a, b) => b.atRisk.length - a.atRisk.length);
  const periodLabel = period === "all" ? tp("allLong") : period.startsWith("y") ? tp("yearLong", { n: period.slice(1) }) : tp("semesterN", { n: period.slice(1) });

  return (
    <ReportShell
      title={t("cohort.title")}
      subtitle={`${periodLabel} · ${t("target", { value: threshold })}${threshold !== data.threshold ? ` (${t("cohort.whatIf", { saved: data.threshold })})` : ""}`}
      backHref="/head"
      generatedBy={user.name}
    >
      <ReportSection title={t("cohort.summary")}>
        <p className="text-sm">{t("cohort.summaryText", { students: data.students.length, cohorts: cohorts.length, atRisk: atRisk.length, target: threshold })}</p>
      </ReportSection>

      {cohorts.length > 0 && (
        <ReportSection title={t("cohort.radar")}>
          <ReportRadar
            plos={data.plos}
            threshold={threshold}
            series={cohorts.slice(-3).map((c) => ({ key: `c${c.year}`, label: `${t("classOf", { year: c.year })} (n=${c.students.length})`, values: c.mean }))}
          />
        </ReportSection>
      )}

      <ReportSection title={t("cohort.means")}>
        <ReportTable
          head={
            <tr>
              <th>PLO</th>
              <th>{t("outcome")}</th>
              {cohorts.map((c) => (
                <th key={c.year} className="text-right">
                  {t("classOf", { year: c.year })}
                </th>
              ))}
            </tr>
          }
        >
          {data.plos.map((p) => (
            <tr key={p.id}>
              <td className="font-medium whitespace-nowrap">{p.code}</td>
              <td>{p.shortLabel}</td>
              {cohorts.map((c) => {
                const v = c.mean[p.number];
                return (
                  <td key={c.year} className="text-right tabular">
                    {v === null ? "—" : isAtRisk(v, threshold) ? <strong>{formatPct(v)}*</strong> : formatPct(v)}
                    {c.aggregate[p.number] && <span className="text-[0.625rem] text-muted"> n={c.aggregate[p.number]!.n}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </ReportTable>
        <p className="mt-1 text-[0.625rem] text-muted">{t("offering.starNote", { target: threshold })}</p>
      </ReportSection>

      <ReportSection title={t("cohort.students")} keepTogether={false}>
        {atRisk.length === 0 ? (
          <p className="text-sm">{t("cohort.none")}</p>
        ) : (
          <ReportTable
            head={
              <tr>
                <th>{t("studentCol")}</th>
                <th>{t("cohortLabel")}</th>
                <th>{t("atRiskPlos")}</th>
              </tr>
            }
          >
            {atRisk.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name}
                  <div className="text-[0.625rem] text-muted">NIM {s.studentId ?? "—"}</div>
                </td>
                <td className="tabular">{s.cohortYear}</td>
                <td>{atRiskPlos(s.values, threshold).map((n) => `PLO ${n} (${s.values[n]!.toFixed(1)})`).join(", ")}</td>
              </tr>
            ))}
          </ReportTable>
        )}
      </ReportSection>
    </ReportShell>
  );
}
