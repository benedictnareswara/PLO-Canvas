"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Dialog, SegmentedControl } from "@/components/ui/client";
import { LOCALES, LOCALE_LABELS, isLocale, type Locale } from "@/i18n/config";
import { changeLocale } from "@/lib/locale-client";
import { setThemeMode, useTheme, type ThemeMode } from "@/lib/theme";

/**
 * Theme and language. Both apply immediately (no Save step). Theme is three-state: "System"
 * follows the OS and shows what it currently resolves to (dark-mode-toggle guidance).
 */
export function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("prefs");
  const tc = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const { mode, resolved } = useTheme();
  const [pending, startTransition] = useTransition();

  function onLocale(next: Locale) {
    startTransition(async () => {
      await changeLocale(next, { signedIn: true });
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      variant="sheet"
      closedby="any"
      title={t("title")}
      description={t("description")}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {tc("close")}
        </Button>
      }
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("theme")}</legend>
          <SegmentedControl<ThemeMode>
            label={t("theme")}
            value={mode}
            onChange={setThemeMode}
            className="w-full [&>label]:flex-1"
            options={[
              { value: "system", label: t("themeSystem"), icon: <Monitor aria-hidden /> },
              { value: "light", label: t("themeLight"), icon: <Sun aria-hidden /> },
              { value: "dark", label: t("themeDark"), icon: <Moon aria-hidden /> },
            ]}
          />
          {mode === "system" && <p className="mt-2 text-xs text-muted">{t("themeSystemCurrent", { mode: t(resolved) })}</p>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
            {t("language")}
            {pending && <Spinner className="ui-delayed size-3.5" />}
          </legend>
          <SegmentedControl<Locale>
            label={t("language")}
            value={isLocale(locale) ? locale : "en"}
            onChange={onLocale}
            className="w-full [&>label]:flex-1"
            options={LOCALES.map((l) => ({ value: l, label: <span lang={l}>{LOCALE_LABELS[l]}</span> }))}
          />
        </fieldset>
      </div>
    </Dialog>
  );
}
