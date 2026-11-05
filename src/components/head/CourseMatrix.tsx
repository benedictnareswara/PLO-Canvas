"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { HeatLegend, HeatValue, heatStyle } from "@/components/analytics/HeatCell";
import { FilterBar } from "@/components/analytics/filters";
import { ExportMenu } from "@/components/ExportMenu";
import { Badge, Card, CardHeader, EmptyState, Select, Table, Td, Th } from "@/components/ui";
import { SegmentedControl } from "@/components/ui/client";
import { downloadCsv, safeFilename, type ExportColumn } from "@/lib/export/csv";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { atRiskPlos } from "@/lib/obe/aggregate";
import { academicYearLabel } from "@/lib/obe/semesters";
import type { OfferingListItem } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";

/** Classes × PLO heatmap of class-mean attainment; each class is judged against its own target. */
export function CourseMatrix({ offerings, plos }: { offerings: OfferingListItem[]; plos: PloInfo[] }) {
  const t = useTranslations("analytics.courses");
  const years = useMemo(() => [...new Set(offerings.map((o) => o.academicYear))].sort((a, b) => b - a), [offerings]);
  const [year, setYear] = useUrlState("year", "all");
  const [term, setTerm] = useUrlState<"all" | "odd" | "even">("term", "all");
  const [phonePlo, setPhonePlo] = useUrlState("plo", String(plos[0]?.number ?? 1));
  const phone = useMediaQuery("(width < 48rem)");
  const shown = offerings.filter((o) => (year === "all" || o.academicYear === Number(year)) && (term === "all" || o.term === term));

  const round = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  const exportColumns: ExportColumn<OfferingListItem>[] = [
    { header: t("class"), value: (o) => `${o.code} ${o.title}`, width: 34 },
    { header: t("period"), value: (o) => o.period },
    { header: t("lecturer"), value: (o) => o.lecturers.join(", "), width: 28 },
    { header: "n", value: (o) => o.studentCount },
    { header: t("target"), value: (o) => o.threshold },
    ...plos.map((p): ExportColumn<OfferingListItem> => ({ header: `${p.code} (%)`, value: (o) => round(o.plo[p.number]), numFmt: "0.0" })),
  ];
  const file = safeFilename("course-attainment", year === "all" ? "all-years" : academicYearLabel(Number(year)), term);

  return (
    <>
      <FilterBar>
        <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label={t("year")}>
          <option value="all">{t("allYears")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {academicYearLabel(y)}
            </option>
          ))}
        </Select>
        <SegmentedControl
          label={t("term")}
          value={term}
          onChange={setTerm}
          options={[
            { value: "all", label: t("bothTerms") },
            { value: "odd", label: t("odd") },
            { value: "even", label: t("even") },
          ]}
        />
        <span className="text-xs text-muted tabular">{t("count", { count: shown.length })}</span>
      </FilterBar>

      <Card>
        <CardHeader
          title={t("title")}
          description={t("description")}
          actions={
            <>
              <HeatLegend low="0%" high="100%" below={t("legendBelow")} />
              <ExportMenu
                size="sm"
                items={[
                  { key: "csv", label: "CSV", format: "csv", run: () => downloadCsv(`${file}.csv`, shown, exportColumns) },
                  { key: "xlsx", label: "Excel", format: "xlsx", run: async () => (await import("@/lib/export/xlsx")).downloadXlsx(`${file}.xlsx`, [{ name: t("title"), rows: shown, columns: exportColumns }]) },
                ]}
              />
            </>
          }
        />
        {shown.length === 0 ? (
          <div className="p-5">
            <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
          </div>
        ) : phone ? (
          <div className="space-y-3 p-4">
            <Select value={phonePlo} onChange={(e) => setPhonePlo(e.target.value)} aria-label={t("pickPlo")} className="h-11 w-full">
              {plos.map((p) => (
                <option key={p.id} value={p.number}>
                  {p.code} · {p.shortLabel}
                </option>
              ))}
            </Select>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {shown.map((o) => {
                const v = o.plo[Number(phonePlo)] ?? null;
                return (
                  <li key={o.id} className="flex items-center gap-3 px-3 py-2.5" style={v === null ? undefined : heatStyle(v, o.threshold)}>
                    <Link href={`/lecturer/offerings/${o.id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-brand">{o.code}</span>
                      <span className="block text-xs text-muted">
                        {o.period} · {t("targetShort", { value: o.threshold })}
                      </span>
                    </Link>
                    <HeatValue value={v} threshold={o.threshold} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <Table label={t("title")} maxHeight="70dvh">
            <thead>
              <tr>
                <Th className="sticky top-0 left-0 z-20">{t("class")}</Th>
                <Th className="sticky top-0 z-10">{t("lecturer")}</Th>
                <Th className="sticky top-0 z-10 text-right">n</Th>
                {plos.map((p) => (
                  <Th key={p.id} className="sticky top-0 z-10 text-center" title={`${p.code}: ${p.description}`}>
                    {p.number}
                  </Th>
                ))}
                <Th className="sticky top-0 z-10">{t("flags")}</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const risky = atRiskPlos(o.plo, o.threshold);
                return (
                  <tr key={o.id} className="group/row">
                    <Td className="sticky left-0 z-[1] bg-surface group-hover/row:bg-surface-2">
                      <Link href={`/lecturer/offerings/${o.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                        {o.code}
                      </Link>
                      <div className="text-xs whitespace-nowrap text-muted">
                        {o.period} · {t("targetShort", { value: o.threshold })}
                      </div>
                    </Td>
                    <Td className="text-xs">{o.lecturers.join(", ")}</Td>
                    <Td className="text-right tabular">{o.studentCount}</Td>
                    {plos.map((p) => {
                      const v = o.plo[p.number] ?? null;
                      return (
                        <Td key={p.id} className="p-1 text-center text-xs" style={v === null ? undefined : heatStyle(v, o.threshold)}>
                          <HeatValue value={v} threshold={o.threshold} />
                        </Td>
                      );
                    })}
                    <Td>
                      {risky.length ? <Badge tone="risk">{t("atRisk", { count: risky.length })}</Badge> : o.assessmentCount ? <Badge tone="ok">{t("ok")}</Badge> : <Badge>{t("noData")}</Badge>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
