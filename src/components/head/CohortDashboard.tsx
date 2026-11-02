"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PloRadar } from "@/components/charts/PloRadarLazy";
import { SERIES } from "@/components/charts/series";
import { AtRiskBadge } from "@/components/AtRiskBadge";
import { FilterBar, PeriodPicker, useAnalyticsFilters } from "@/components/analytics/filters";
import { ExportMenu } from "@/components/ExportMenu";
import { Printer } from "lucide-react";
import { ButtonLink, Card, CardBody, CardHeader, SummaryStrip, Table, Td, Th, ToggleChip } from "@/components/ui";
import { Tooltip } from "@/components/ui/client";
import { downloadCsv, safeFilename, type ExportColumn } from "@/lib/export/csv";
import { urlList, useUrlState } from "@/lib/hooks/useUrlState";
import { atRiskPlos, summarizeCohorts } from "@/lib/obe/aggregate";
import type { StudentsWithRows } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";

/** Cohort comparison: one radar polygon per graduation cohort (up to three overlaid). */
export function CohortDashboard({ data }: { data: StudentsWithRows }) {
  const t = useTranslations("analytics.cohort");
  const { period, setPeriod } = useAnalyticsFilters(data.threshold);
  const cohorts = useMemo(() => summarizeCohorts(data.students, data.sums, data.plos, data.threshold, period), [data, period]);
  const defaultCohorts = useMemo(() => cohorts.slice(-SERIES.length).map((c) => String(c.year)), [cohorts]);
  const [selectedRaw, setSelected] = useUrlState<string[]>("cohorts", defaultCohorts, urlList);
  const selected = selectedRaw.map(Number).filter((y) => cohorts.some((c) => c.year === y));
  const shown = cohorts.filter((c) => selected.includes(c.year)).slice(0, SERIES.length);

  function toggle(year: number, on: boolean) {
    const next = on ? [...selected, year].sort() : selected.filter((y) => y !== year);
    setSelected(next.map(String));
  }

  const studentsAtRisk = cohorts.flatMap((c) => c.students).filter((s) => s.atRisk.length).length;
  const ploCode = (n: number) => data.plos.find((p) => p.number === n)?.code ?? `PLO ${n}`;

  const exportColumns: ExportColumn<PloInfo>[] = [
    { header: "PLO", value: (p) => p.code },
    { header: t("outcome"), value: (p) => p.shortLabel, width: 30 },
    ...cohorts.flatMap((c): ExportColumn<PloInfo>[] => [
      { header: `${t("classOf", { year: c.year })} (%)`, value: (p) => (c.mean[p.number] === null ? null : Math.round(c.mean[p.number]! * 10) / 10), numFmt: "0.0" },
      { header: `${t("classOf", { year: c.year })} n`, value: (p) => c.aggregate[p.number]?.n ?? null },
    ]),
  ];
  const file = safeFilename("cohort-comparison", period);

  return (
    <div className="space-y-6">
      <FilterBar>
        <PeriodPicker value={period} onChange={setPeriod} />
        <ButtonLink href={`/reports/cohort?period=${period}`} className="ml-auto">
          <Printer aria-hidden /> {t("printReport")}
        </ButtonLink>
      </FilterBar>

      <SummaryStrip
        className="mb-0"
        items={[
          { label: t("students"), value: data.students.length, hint: t("cohorts", { count: cohorts.length }) },
          { label: t("needIntervention"), value: studentsAtRisk, tone: studentsAtRisk ? "risk" : "ok", hint: t("needInterventionHint", { target: data.threshold }) },
          ...cohorts.slice(-2).map((c) => {
            const risky = atRiskPlos(c.mean, data.threshold);
            return {
              label: t("cohortPlosAtRisk", { year: c.year }),
              value: risky.length,
              tone: risky.length ? ("risk" as const) : ("ok" as const),
              hint: risky.length ? risky.map(ploCode).join(", ") : t("allMet", { target: data.threshold }),
            };
          }),
        ]}
      />

      <Card>
        <CardHeader
          title={t("chartTitle")}
          description={t("chartDescription", { target: data.threshold })}
          actions={
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("cohortPicker")}>
              {cohorts.map((c) => {
                const idx = shown.findIndex((s) => s.year === c.year);
                const full = !selected.includes(c.year) && selected.length >= SERIES.length;
                const chip = (
                  <ToggleChip checked={selected.includes(c.year)} onChange={(on) => toggle(c.year, on)} swatch={idx >= 0 ? SERIES[idx].color : undefined} disabled={full}>
                    {t("classOf", { year: c.year })}
                  </ToggleChip>
                );
                return full ? (
                  <Tooltip key={c.year} content={t("maxSeries", { max: SERIES.length })}>
                    <span tabIndex={0}>{chip}</span>
                  </Tooltip>
                ) : (
                  <span key={c.year}>{chip}</span>
                );
              })}
            </div>
          }
        />
        <CardBody>
          {shown.length ? (
            <PloRadar
              plos={data.plos}
              threshold={data.threshold}
              height={440}
              series={shown.map((c) => ({ key: `c${c.year}`, label: t("seriesLabel", { year: c.year, n: c.students.length }), values: c.mean }))}
            />
          ) : (
            <p className="py-16 text-center text-sm text-muted">{t("pickCohort")}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("tableTitle")}
          description={t("tableDescription")}
          actions={
            <ExportMenu
              size="sm"
              items={[
                { key: "csv", label: "CSV", format: "csv", run: () => downloadCsv(`${file}.csv`, data.plos, exportColumns) },
                { key: "xlsx", label: "Excel", format: "xlsx", run: async () => (await import("@/lib/export/xlsx")).downloadXlsx(`${file}.xlsx`, [{ name: t("tableTitle"), rows: data.plos, columns: exportColumns }]) },
              ]}
            />
          }
        />
        <Table label={t("tableTitle")}>
          <thead>
            <tr>
              <Th className="sticky left-0 z-10">PLO</Th>
              {cohorts.map((c) => (
                <Th key={c.year} className="text-right">
                  {t("classOf", { year: c.year })}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.plos.map((p) => (
              <tr key={p.id}>
                <Td title={p.description} className="sticky left-0 bg-surface">
                  <span className="font-medium">{p.code}</span> <span className="text-muted">{p.shortLabel}</span>
                </Td>
                {cohorts.map((c) => (
                  <Td key={c.year} className="text-right whitespace-nowrap">
                    <AtRiskBadge value={c.mean[p.number]} threshold={data.threshold} />
                    {c.aggregate[p.number] && <span className="ml-2 text-xs text-muted tabular">n={c.aggregate[p.number]!.n}</span>}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
