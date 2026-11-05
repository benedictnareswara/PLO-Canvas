"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { createColumnHelper } from "@tanstack/react-table";
import { PloCell } from "@/components/AtRiskBadge";
import { ExportMenu } from "@/components/ExportMenu";
import { Badge, ToggleChip } from "@/components/ui";
import { DataTable } from "@/components/ui/data-table";
import { downloadCsv, safeFilename, type ExportColumn } from "@/lib/export/csv";
import { useCurrentHref } from "@/lib/hooks/useCurrentHref";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { atRiskPlos, cumulativeForStudent, toPloValues } from "@/lib/obe/aggregate";
import type { PeriodFilter } from "@/lib/obe/semesters";
import type { AttainmentSum, PloInfo, PloValues, StudentSummary } from "@/lib/obe/types";

type Row = StudentSummary & { values: PloValues; risky: number[] };
const col = createColumnHelper<Row>();

/**
 * Students × PLO cumulative attainment. The period and threshold come from the page's filter bar
 * (one filter bar per page); sortable by how many PLOs are at risk; exports what is shown.
 */
export function StudentAttainmentTable({
  students,
  sums,
  plos,
  threshold,
  period,
  initialAtRiskOnly = false,
  exportName,
  urlKey = "",
}: {
  students: StudentSummary[];
  sums: AttainmentSum[];
  plos: PloInfo[];
  threshold: number;
  period: PeriodFilter;
  initialAtRiskOnly?: boolean;
  exportName: string;
  urlKey?: string;
}) {
  const t = useTranslations("studentsTable");
  // Profile links carry this view (filters included) so the breadcrumb returns to it.
  const from = useCurrentHref();
  const [atRiskOnly, setAtRiskOnly] = useUrlState(`${urlKey}risk`, initialAtRiskOnly, {
    parse: (r) => r === "1",
    serialize: (v) => (v ? "1" : "0"),
  });
  const rows = useMemo<Row[]>(
    () =>
      students.map((s) => {
        const values = toPloValues(cumulativeForStudent(sums, s.id, period), plos);
        return { ...s, values, risky: atRiskPlos(values, threshold) };
      }),
    [students, sums, plos, period, threshold],
  );
  const shown = atRiskOnly ? rows.filter((r) => r.risky.length) : rows;

  const columns = useMemo(
    () => [
      col.accessor((r) => `${r.name} ${r.studentId ?? ""}`, {
        id: "student",
        header: t("student"),
        meta: { primary: true },
        cell: ({ row: { original: r } }) => (
          <div>
            <Link href={`/students/${r.id}?from=${encodeURIComponent(from)}`} className="font-medium text-brand underline-offset-2 hover:underline">
              {r.name}
            </Link>
            <div className="text-xs text-muted tabular">NIM {r.studentId ?? "—"}</div>
          </div>
        ),
      }),
      col.accessor((r) => r.cohortYear ?? 0, { id: "cohort", header: t("cohort"), meta: { numeric: true }, cell: ({ row: { original: r } }) => r.cohortYear ?? "—" }),
      ...plos.map((p) =>
        col.accessor((r) => r.values[p.number] ?? -1, {
          id: `plo${p.number}`,
          header: () => <span title={p.description}>{p.number}</span>,
          meta: { label: p.code, className: "text-center" },
          cell: ({ row: { original: r } }) => <PloCell value={r.values[p.number]} threshold={threshold} />,
        }),
      ),
      col.accessor((r) => r.risky.length, {
        id: "status",
        header: t("status"),
        sortDescFirst: true,
        cell: ({ getValue }) => (getValue() ? <Badge tone="risk">{t("atRisk", { count: getValue() })}</Badge> : <Badge tone="ok">{t("onTrack")}</Badge>),
      }),
    ],
    [plos, threshold, from, t],
  );

  const exportColumns: ExportColumn<Row>[] = [
    { header: "NIM", value: (r) => r.studentId },
    { header: t("student"), value: (r) => r.name },
    { header: t("email"), value: (r) => r.email },
    { header: t("cohort"), value: (r) => r.cohortYear },
    ...plos.map((p): ExportColumn<Row> => ({ header: `${p.code} (%)`, value: (r) => (r.values[p.number] === null ? null : Math.round(r.values[p.number]! * 10) / 10), numFmt: "0.0" })),
    { header: t("atRiskPlos"), value: (r) => r.risky.map((n) => `PLO ${n}`).join(", ") },
  ];
  const file = safeFilename(exportName, period, `${threshold}pct`);

  return (
    <DataTable
      data={shown}
      columns={columns}
      label={t("label")}
      searchable
      searchPlaceholder={t("search")}
      urlKey={urlKey}
      initialSort={[{ id: "status", desc: true }]}
      getRowId={(r) => r.id}
      pageSize={50}
      stickyFirstColumn
      empty={<p className="py-6 text-center text-sm text-muted">{atRiskOnly ? t("noneAtRisk") : t("none")}</p>}
      toolbar={
        <ToggleChip checked={atRiskOnly} onChange={setAtRiskOnly}>
          {t("atRiskOnly", { count: rows.filter((r) => r.risky.length).length })}
        </ToggleChip>
      }
      exportSlot={
        <ExportMenu
          size="sm"
          items={[
            { key: "csv", label: t("exportCsv"), format: "csv", run: () => downloadCsv(`${file}.csv`, shown, exportColumns) },
            {
              key: "xlsx",
              label: t("exportXlsx"),
              format: "xlsx",
              run: async () => (await import("@/lib/export/xlsx")).downloadXlsx(`${file}.xlsx`, [{ name: t("label"), rows: shown, columns: exportColumns }]),
            },
          ]}
        />
      }
    />
  );
}
