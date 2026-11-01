"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Radar } from "lucide-react";
import { ButtonLink, Card, CardBody, CardHeader, EmptyState, SummaryStrip, Table, Td, Th, cn } from "@/components/ui";
import { AtRiskBadge, PloCell, formatPct } from "@/components/AtRiskBadge";
import { PloRadar } from "@/components/charts/PloRadar";
import { cohortAggregate, isAtRisk } from "@/lib/obe/engine";
import type { OfferingDetail } from "@/lib/obe/queries";

export function RadarTab({ detail, canEdit }: { detail: OfferingDetail; canEdit: boolean }) {
  const t = useTranslations("offering.radar");
  const { plos, students, attainment, threshold } = detail;
  const stats = useMemo(
    () =>
      cohortAggregate(
        students.map(
          (s) =>
            new Map(
              Object.entries(attainment[s.id] ?? {})
                .filter(([, v]) => v !== null)
                .map(([k, v]) => [Number(k), v as number]),
            ),
        ),
      ),
    [students, attainment],
  );
  const mean = Object.fromEntries(plos.map((p) => [p.number, stats.get(p.number)?.mean ?? null]));
  const evidenced = plos.filter((p) => stats.has(p.number));
  const riskyPlos = evidenced.filter((p) => isAtRisk(stats.get(p.number)!.mean, threshold));
  const studentsAtRisk = students.filter((s) => Object.values(attainment[s.id] ?? {}).some((v) => isAtRisk(v, threshold)));
  const unmeasured = detail.coursePloNumbers.filter((n) => !stats.has(n));

  if (!detail.assessments.length) {
    return (
      <EmptyState
        icon={<Radar />}
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={canEdit && <ButtonLink href="?tab=assessments">{t("addAssessments")}</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SummaryStrip
        className="mb-0"
        items={[
          { label: t("enrolled"), value: students.length },
          {
            label: t("plosMeasured"),
            value: `${evidenced.length}/${detail.coursePloNumbers.length || evidenced.length}`,
            hint: unmeasured.length ? t("notMeasured", { list: unmeasured.join(", ") }) : t("allMeasured"),
            tone: unmeasured.length ? "warn" : undefined,
          },
          {
            label: t("plosBelow"),
            value: riskyPlos.length,
            tone: riskyPlos.length ? "risk" : "ok",
            hint: riskyPlos.length ? riskyPlos.map((p) => p.code).join(", ") : t("target", { value: threshold }),
          },
          {
            label: t("studentsAtRisk"),
            value: studentsAtRisk.length,
            tone: studentsAtRisk.length ? "risk" : "ok",
            hint: t("ofStudents", { count: students.length }),
          },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title={t("chartTitle")} description={t("chartDescription")} />
          <CardBody>
            <PloRadar plos={plos} threshold={threshold} series={[{ key: "mean", label: t("classMean"), values: mean }]} showTable={false} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("distributionTitle")} description={t("distributionDescription")} />
          <Table label={t("distributionTitle")}>
            <thead>
              <tr>
                <Th>PLO</Th>
                <Th className="text-right">{t("mean")}</Th>
                <Th className="text-right">{t("range")}</Th>
                <Th className="text-right">{t("below")}</Th>
              </tr>
            </thead>
            <tbody>
              {evidenced.map((p) => {
                const s = stats.get(p.number)!;
                const below = students.filter((st) => isAtRisk(attainment[st.id]?.[p.number], threshold)).length;
                return (
                  <tr key={p.id}>
                    <Td title={p.description}>
                      <span className="font-medium">{p.code}</span>
                      <span className="ml-1.5 text-xs text-muted">{p.shortLabel}</span>
                    </Td>
                    <Td className="text-right">
                      <AtRiskBadge value={s.mean} threshold={threshold} compact />
                    </Td>
                    <Td className="text-right text-muted tabular">
                      {s.min.toFixed(0)}–{s.max.toFixed(0)}
                    </Td>
                    <Td className={cn("text-right tabular", below && "font-semibold text-risk")}>
                      {below}/{s.n}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card>
        <CardHeader title={t("studentsTitle")} description={t("studentsDescription")} />
        <Table label={t("studentsTitle")} maxHeight="36rem">
          <thead>
            <tr>
              <Th className="sticky top-0 left-0 z-20">{t("student")}</Th>
              {evidenced.map((p) => (
                <Th key={p.id} className="sticky top-0 z-10 text-center" title={p.description}>
                  {p.code}
                </Th>
              ))}
              <Th className="sticky top-0 z-10 text-right">{t("courseGrade")}</Th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <Td className="sticky left-0 bg-surface">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted tabular">{s.studentId}</div>
                </Td>
                {evidenced.map((p) => (
                  <Td key={p.id} className="text-center">
                    <PloCell value={attainment[s.id]?.[p.number] ?? null} threshold={threshold} />
                  </Td>
                ))}
                <Td className="text-right whitespace-nowrap tabular">
                  {formatPct(detail.courseGrades[s.id]?.pct)}
                  <span className="ml-2 inline-block min-w-7 rounded bg-brand-soft px-1.5 py-0.5 text-center text-xs font-medium text-brand">
                    {detail.courseGrades[s.id]?.letter}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
