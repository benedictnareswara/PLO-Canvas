import { getTranslations } from "next-intl/server";
import { ChartCardSkeleton, PageHeaderSkeleton, RouteSkeleton, SummaryStripSkeleton, TableSkeleton } from "@/components/skeletons";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <RouteSkeleton label={t("loading")}>
      <PageHeaderSkeleton />
      <SummaryStripSkeleton />
      <div className="mb-6">
        <ChartCardSkeleton />
      </div>
      <TableSkeleton rows={4} />
    </RouteSkeleton>
  );
}
