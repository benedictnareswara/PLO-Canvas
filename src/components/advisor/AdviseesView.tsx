"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui";
import { FilterBar, PeriodPicker, useAnalyticsFilters } from "@/components/analytics/filters";
import { StudentAttainmentTable } from "@/components/StudentAttainmentTable";
import { unpackSums } from "@/lib/obe/aggregate";
import type { StudentsWithRows } from "@/lib/obe/queries";

/** An advisor's students: one period filter, sortable by how many PLOs are at risk. */
export function AdviseesView({ data }: { data: StudentsWithRows }) {
  const t = useTranslations("advisees");
  const { period, setPeriod } = useAnalyticsFilters(data.threshold);
  const sums = useMemo(() => unpackSums(data.sums), [data.sums]);
  return (
    <>
      <FilterBar>
        <PeriodPicker value={period} onChange={setPeriod} />
      </FilterBar>
      <Card>
        <CardHeader title={t("tableTitle")} description={t("tableDescription", { threshold: data.threshold })} />
        <StudentAttainmentTable
          students={data.students}
          sums={sums}
          plos={data.plos}
          threshold={data.threshold}
          period={period}
          exportName="advisees"
        />
      </Card>
    </>
  );
}
