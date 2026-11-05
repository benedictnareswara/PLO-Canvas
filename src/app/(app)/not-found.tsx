import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

/** `notFound()` inside the app (missing record or no access): same message for both, so it doesn't leak existence. */
export default async function AppNotFound() {
  const t = await getTranslations("errors");
  return (
    <EmptyState
      className="mt-10"
      icon={<SearchX />}
      title={<h1 className="text-base font-semibold">{t("notFoundTitle")}</h1>}
      description={t("notFoundBody")}
      action={<ButtonLink href="/">{t("goHome")}</ButtonLink>}
    />
  );
}
