"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { Dialog, SegmentedControl } from "@/components/ui/client";
import { LOCALES, LOCALE_LABELS, isLocale, type Locale } from "@/i18n/config";
import { changeLocale } from "@/lib/locale-client";
import { setThemeMode, useTheme, type ThemeMode } from "@/lib/theme";

/**
 * Theme, language and password. Theme and language apply immediately (no Save step). Theme is three-state: "System"
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

        <ChangePassword />
      </div>
    </Dialog>
  );
}

/** Changes the signed-in user's password. Other sessions end; this one continues. */
function ChangePassword() {
  const t = useTranslations("prefs");
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword.length < 8) return setErrors({ next: t("passwordTooShort") });
    if (newPassword === currentPassword) return setErrors({ next: t("passwordSame") });
    setPending(true);
    setErrors({});
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 400) return setErrors({ current: t("passwordCurrentWrong") });
      if (!res.ok) return setErrors({ form: t("passwordFailed") });
      form.reset();
      toast.success(t("passwordChanged"));
    } catch {
      setErrors({ form: t("passwordFailed") });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">{t("password")}</legend>
        <Field label={t("passwordCurrent")} htmlFor="pref-current-password" error={errors.current}>
          <Input id="pref-current-password" name="currentPassword" type="password" autoComplete="current-password" required invalid={!!errors.current} aria-describedby={errors.current ? "pref-current-password-error" : undefined} />
        </Field>
        <Field label={t("passwordNew")} hint={t("passwordHint")} htmlFor="pref-new-password" error={errors.next}>
          <Input id="pref-new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} invalid={!!errors.next} aria-describedby={errors.next ? "pref-new-password-error" : "pref-new-password-hint"} />
        </Field>
        {errors.form && (
          <p role="alert" className="text-xs font-medium text-risk">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="secondary" loading={pending}>
          {t("passwordSubmit")}
        </Button>
      </fieldset>
    </form>
  );
}
