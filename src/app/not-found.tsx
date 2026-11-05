import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors");
  return { title: t("notFoundTitle") };
}

/** Unmatched URLs (outside any route). Rendered without the app shell. */
export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        className="w-full max-w-md border-solid bg-surface"
        icon={<SearchX />}
        title={<h1 className="text-base font-semibold">{t("notFoundTitle")}</h1>}
        description={t("notFoundBody")}
        action={<ButtonLink href="/">{t("goHome")}</ButtonLink>}
      />
    </main>
  );
}
