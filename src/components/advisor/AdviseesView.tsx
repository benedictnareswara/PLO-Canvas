"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui";
import { FilterBar, PeriodPicker, useAnalyticsFilters } from "@/components/analytics/filters";
import { StudentAttainmentTable } from "@/components/StudentAttainmentTable";
import type { StudentsWithRows } from "@/lib/obe/queries";

/** An advisor's students: one period filter, sortable by how many PLOs are at risk. */
export function AdviseesView({ data }: { data: StudentsWithRows }) {
  const t = useTranslations("advisees");
  const { period, setPeriod } = useAnalyticsFilters(data.threshold);
  return (
    <>
      <FilterBar>
        <PeriodPicker value={period} onChange={setPeriod} />
      </FilterBar>
      <Card>
        <CardHeader title={t("tableTitle")} description={t("tableDescription", { threshold: data.threshold })} />
        <StudentAttainmentTable
          students={data.students}
          sums={data.sums}
          plos={data.plos}
          threshold={data.threshold}
          period={period}
          from="/lecturer/advisees"
          exportName="advisees"
        />
      </Card>
    </>
  );
}
