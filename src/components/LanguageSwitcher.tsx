"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Spinner } from "@/components/ui";
import { SegmentedControl } from "@/components/ui/client";
import { LOCALES, isLocale, type Locale } from "@/i18n/config";
import { changeLocale } from "@/lib/locale-client";

const SHORT: Record<Locale, string> = { en: "English", id: "Indonesia" };

/** Compact language choice for signed-out pages; the account adopts it at sign-in. */
export function LanguageSwitcher() {
  const t = useTranslations("prefs");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {pending ? <Spinner className="ui-delayed size-4" /> : <Languages className="size-4 text-muted" aria-hidden />}
      <SegmentedControl<Locale>
        size="sm"
        label={t("language")}
        value={isLocale(locale) ? locale : "en"}
        onChange={(next) =>
          startTransition(async () => {
            await changeLocale(next, { signedIn: false });
            router.refresh();
          })
        }
        options={LOCALES.map((l) => ({ value: l, label: <span lang={l}>{SHORT[l]}</span> }))}
      />
    </div>
  );
}
