import { getTranslations } from "next-intl/server";
import { PageHeaderSkeleton, RouteSkeleton, TableSkeleton } from "@/components/skeletons";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <RouteSkeleton label={t("loading")}>
      <PageHeaderSkeleton />
      <TableSkeleton />
    </RouteSkeleton>
  );
}
