"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Copy, Printer, X } from "lucide-react";
import { Badge, Button, ButtonLink, Card, CardHeader, Select, Table, Td, Th, cn } from "@/components/ui";
import { formatPct } from "@/components/AtRiskBadge";
import { FilterBar, PeriodPicker, ThresholdWhatIf, useAnalyticsFilters } from "@/components/analytics/filters";
import { HeatLegend, HeatValue, heatStyle } from "@/components/analytics/HeatCell";
import { ExportMenu } from "@/components/ExportMenu";
import { StudentAttainmentTable } from "@/components/StudentAttainmentTable";
import { downloadCsv, safeFilename } from "@/lib/export/csv";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useCurrentHref } from "@/lib/hooks/useCurrentHref";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { isAtRisk } from "@/lib/obe/engine";
import { summarizeCohorts, unpackSums, type CohortSummary } from "@/lib/obe/aggregate";
import type { StudentsWithRows } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";

/**
 * At-risk detection: cohort × PLO means against the threshold, with a drill-down (opened right
 * under its row) to the students who need academic intervention.
 */
export function AtRiskDashboard({ data }: { data: StudentsWithRows }) {
  const t = useTranslations("analytics.atRisk");
  const { period, setPeriod, threshold, setThreshold } = useAnalyticsFilters(data.threshold);
  const sums = useMemo(() => unpackSums(data.sums), [data.sums]);
  const cohorts = useMemo(() => summarizeCohorts(data.students, sums, data.plos, threshold, period), [data, sums, threshold, period]);
  const [drill, setDrill] = useState<{ year: number; plo: number } | null>(null);
  const phone = useMediaQuery("(width < 48rem)");
  const [phonePlo, setPhonePlo] = useUrlState("plo", String(data.plos[0]?.number ?? 1));

  const belowCount = (c: CohortSummary, plo: number) => c.students.filter((s) => isAtRisk(s.values[plo], threshold)).length;

  function cell(c: CohortSummary, p: PloInfo) {
    const mean = c.mean[p.number];
    if (mean === null) return <span className="text-xs text-muted">{t("noEvidence")}</span>;
    const below = belowCount(c, p.number);
    const active = drill?.year === c.year && drill.plo === p.number;
    return (
      <button
        type="button"
        onClick={() => setDrill(active ? null : { year: c.year, plo: p.number })}
        disabled={below === 0}
        aria-expanded={below ? active : undefined}
        aria-label={t("cellLabel", { cohort: c.year, plo: p.code, mean: mean.toFixed(1), below })}
        style={heatStyle(mean, threshold)}
        className={cn(
          "inline-flex w-full min-w-36 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-shadow duration-(--dur-1)",
          below > 0 && "cursor-pointer hover:ring-2 hover:ring-brand/40 focus-visible:outline-2 focus-visible:outline-brand",
          active && "ring-2 ring-brand",
        )}
      >
        <HeatValue value={mean} threshold={threshold} />
        {below > 0 ? (
          <span className="rounded bg-surface px-1.5 text-xs font-medium text-risk">{t("below", { count: below })}</span>
        ) : (
          <span className="text-xs text-muted">{t("allMet")}</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <FilterBar>
        <PeriodPicker value={period} onChange={setPeriod} />
        <ThresholdWhatIf value={threshold} saved={data.threshold} onChange={setThreshold} />
        <ButtonLink href={`/reports/cohort?period=${period}&threshold=${threshold}`} className="ml-auto">
          <Printer aria-hidden /> {t("printReport")}
        </ButtonLink>
      </FilterBar>

      <Card>
        <CardHeader
          title={t("matrixTitle")}
          description={t("matrixDescription")}
          actions={<HeatLegend low="0%" high="100%" below={t("legendBelow", { threshold })} />}
        />
        {phone ? (
          <div className="space-y-3 p-4">
            <Select value={phonePlo} onChange={(e) => setPhonePlo(e.target.value)} aria-label={t("pickPlo")} className="h-11 w-full">
              {data.plos.map((p) => (
                <option key={p.id} value={p.number}>
                  {p.code} · {p.shortLabel}
                </option>
              ))}
            </Select>
            {(() => {
              const p = data.plos.find((x) => String(x.number) === phonePlo) ?? data.plos[0];
              return (
                <ul className="space-y-2">
                  {cohorts.map((c) => (
                    <li key={c.year}>
                      <div className="mb-1 text-xs font-medium text-muted">
                        {t("classOf", { year: c.year })} · n={c.students.length}
                      </div>
                      {cell(c, p)}
                      {drill?.year === c.year && drill.plo === p.number && <DrillDown cohort={c} plo={p} threshold={threshold} period={period} onClose={() => setDrill(null)} />}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        ) : (
          <Table label={t("matrixTitle")}>
            <thead>
              <tr>
                <Th className="sticky left-0 z-10">PLO</Th>
                {cohorts.map((c) => (
                  <Th key={c.year} className="text-center">
                    {t("classOf", { year: c.year })} <span className="font-normal">(n={c.students.length})</span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.plos.map((p) => {
                const open = drill?.plo === p.number ? cohorts.find((c) => c.year === drill.year) : undefined;
                return (
                  <Fragment key={p.id}>
                    <tr>
                      <Td title={p.description} className="sticky left-0 bg-surface">
                        <div className="font-medium">{p.code}</div>
                        <div className="text-xs text-muted">{p.shortLabel}</div>
                      </Td>
                      {cohorts.map((c) => (
                        <Td key={c.year} className="text-center">
                          {cell(c, p)}
                        </Td>
                      ))}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={cohorts.length + 1} className="border-b border-border bg-surface-2/60 p-0">
                          <DrillDown cohort={open} plo={p} threshold={threshold} period={period} onClose={() => setDrill(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title={t("studentsTitle")} description={t("studentsDescription", { threshold })} />
        <StudentAttainmentTable
          students={data.students}
          sums={sums}
          plos={data.plos}
          threshold={threshold}
          period={period}
          initialAtRiskOnly
          exportName="students-at-risk"
        />
      </Card>
    </div>
  );
}

function DrillDown({
  cohort,
  plo,
  threshold,
  period,
  onClose,
}: {
  cohort: CohortSummary;
  plo: PloInfo;
  threshold: number;
  period: string;
  onClose: () => void;
}) {
  const t = useTranslations("analytics.atRisk");
  const from = useCurrentHref();
  const students = cohort.students.filter((s) => isAtRisk(s.values[plo.number], threshold)).sort((a, b) => (a.values[plo.number] ?? 0) - (b.values[plo.number] ?? 0));

  async function copyEmails() {
    try {
      await navigator.clipboard.writeText(students.map((s) => s.email).join(", "));
      toast.success(t("copied", { count: students.length }));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  const file = safeFilename(`class-of-${cohort.year}`, plo.code, "below", `${threshold}pct`, period);

  return (
    <div className="ui-enter px-4 py-4 sm:px-5" role="region" aria-label={t("drillTitle", { year: cohort.year, plo: plo.code, threshold })}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t("drillTitle", { year: cohort.year, plo: plo.code, threshold })}</h3>
          <p className="text-xs text-muted">{plo.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={copyEmails}>
            <Copy aria-hidden /> {t("copyEmails")}
          </Button>
          <ExportMenu
            size="sm"
            items={[
              {
                key: "csv",
                label: "CSV",
                format: "csv",
                run: () =>
                  downloadCsv(`${file}.csv`, students, [
                    { header: "NIM", value: (s) => s.studentId },
                    { header: t("student"), value: (s) => s.name },
                    { header: "Email", value: (s) => s.email },
                    { header: `${plo.code} (%)`, value: (s) => (s.values[plo.number] === null ? null : Math.round(s.values[plo.number]! * 10) / 10) },
                    { header: t("otherRisk"), value: (s) => s.atRisk.filter((n) => n !== plo.number).map((n) => `PLO ${n}`).join(", ") },
                  ]),
              },
            ]}
          />
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={t("close")}>
            <X />
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
            <div className="min-w-40 flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted tabular">NIM {s.studentId}</div>
            </div>
            <div className="w-24 text-right">
              <div className="font-semibold text-risk tabular">{formatPct(s.values[plo.number])}</div>
              <div className="text-xs text-muted tabular">{t("gap", { gap: (threshold - (s.values[plo.number] ?? 0)).toFixed(1) })}</div>
            </div>
            <div className="flex min-w-32 flex-1 flex-wrap gap-1">
              {s.atRisk.filter((n) => n !== plo.number).map((n) => (
                <Badge key={n} tone="risk">
                  PLO {n}
                </Badge>
              ))}
              {s.atRisk.filter((n) => n !== plo.number).length === 0 && <span className="text-xs text-muted">{t("noOther")}</span>}
            </div>
            <Link
              href={`/students/${s.id}?from=${encodeURIComponent(from)}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              {t("profile")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
