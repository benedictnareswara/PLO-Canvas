import { getTranslations } from "next-intl/server";
import { ChartCardSkeleton, PageHeaderSkeleton, RouteSkeleton, SummaryStripSkeleton, TabsSkeleton } from "@/components/skeletons";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <RouteSkeleton label={t("loading")}>
      <PageHeaderSkeleton crumbs action />
      <TabsSkeleton />
      <SummaryStripSkeleton />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <ChartCardSkeleton />
        <ChartCardSkeleton height={240} />
      </div>
    </RouteSkeleton>
  );
}
