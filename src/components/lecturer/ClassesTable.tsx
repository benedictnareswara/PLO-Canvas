"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge, Select } from "@/components/ui";
import { DataTable } from "@/components/ui/data-table";
import { PloCell } from "@/components/AtRiskBadge";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { atRiskPlos } from "@/lib/obe/aggregate";
import type { OfferingListItem } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";

const col = createColumnHelper<OfferingListItem>();
const periodKey = (o: OfferingListItem) => `${o.academicYear}-${o.term}`;

export function ClassesTable({ offerings, plos }: { offerings: OfferingListItem[]; plos: PloInfo[] }) {
  const t = useTranslations("classes");
  const [period, setPeriod] = useUrlState("period", "all");
  const periods = useMemo(() => [...new Map(offerings.map((o) => [periodKey(o), o.period])).entries()], [offerings]);
  const rows = useMemo(() => (period === "all" ? offerings : offerings.filter((o) => periodKey(o) === period)), [offerings, period]);
  const ploCode = new Map(plos.map((p) => [p.number, p.code]));

  const columns = useMemo(
    () => [
      col.accessor((o) => `${o.code} ${o.title}`, {
        id: "course",
        header: t("colCourse"),
        meta: { primary: true },
        cell: ({ row: { original: o } }) => (
          <div>
            <Link href={`/lecturer/offerings/${o.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
              {o.code} · {o.title}
            </Link>
            <div className="text-xs text-muted">{t("meta", { sks: o.sks, target: o.threshold })}</div>
          </div>
        ),
      }),
      col.accessor((o) => o.academicYear * 10 + (o.term === "even" ? 1 : 0), {
        id: "period",
        header: t("colPeriod"),
        cell: ({ row: { original: o } }) => <span className="whitespace-nowrap">{o.period}</span>,
      }),
      col.accessor("studentCount", { header: t("colStudents"), meta: { numeric: true } }),
      col.accessor("assessmentCount", { header: t("colAssessments"), meta: { numeric: true } }),
      col.display({
        id: "plos",
        header: t("colPlos"),
        meta: { label: t("colPlos") },
        cell: ({ row: { original: o } }) => {
          const shown = plos.filter((p) => o.plo[p.number] !== null);
          if (!shown.length) return <span className="text-xs text-muted">{o.assessmentCount ? t("noEvidence") : t("noAssessments")}</span>;
          return (
            <div className="flex flex-wrap justify-end gap-1.5 @min-[40rem]:justify-start">
              {shown.map((p) => (
                <span key={p.id} className="flex items-center gap-1 text-xs">
                  <span className="text-muted">{ploCode.get(p.number)}</span>
                  <PloCell value={o.plo[p.number]} threshold={o.threshold} />
                </span>
              ))}
            </div>
          );
        },
      }),
      col.accessor((o) => atRiskPlos(o.plo, o.threshold).length, {
        id: "status",
        header: t("colStatus"),
        cell: ({ row: { original: o }, getValue }) => {
          const risky = getValue();
          return risky ? (
            <Badge tone="risk">{t("atRisk", { count: risky })}</Badge>
          ) : o.assessmentCount ? (
            <Badge tone="ok">{t("onTarget")}</Badge>
          ) : (
            <Badge>{t("pending")}</Badge>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plos, t],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      label={t("allTitle")}
      searchable
      searchPlaceholder={t("search")}
      initialSort={[{ id: "period", desc: true }]}
      getRowId={(o) => o.id}
      toolbar={
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={t("periodFilter")}>
          <option value="all">{t("allPeriods")}</option>
          {periods.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      }
    />
  );
}
