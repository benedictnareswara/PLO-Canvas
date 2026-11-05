"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { Notice } from "@/components/ui/client";

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const expired = params.get("reason") === "expired";
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 401 || res.status === 400 ? t("login.invalid") : (data.error ?? t("errors.network")));
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : data.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof TypeError ? t("errors.network") : (err as Error).message);
      setPending(false);
      // Back to the field most likely to need retyping, with its contents selected.
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  }

  function trackCapsLock(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  const describedBy = [error && "login-error", capsLock && "login-caps"].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {expired && !error && <Notice tone="info">{t("login.expired")}</Notice>}
      <Field label={t("login.email")} htmlFor="login-email">
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          required
          placeholder={t("login.emailPlaceholder")}
          invalid={!!error}
          aria-describedby={error ? "login-error" : undefined}
        />
      </Field>
      <Field label={t("login.password")} htmlFor="login-password">
        <div className="relative">
          <Input
            ref={passwordRef}
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            invalid={!!error}
            aria-describedby={describedBy}
            onKeyDown={trackCapsLock}
            onKeyUp={trackCapsLock}
            onBlur={() => setCapsLock(false)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
            aria-pressed={showPassword}
            aria-controls="login-password"
            className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        <p id="login-caps" aria-live="polite" className="mt-1.5 flex min-h-0 items-center gap-1.5 text-xs font-medium text-warn empty:hidden">
          {capsLock && (
            <>
              <TriangleAlert className="size-3.5" aria-hidden />
              {t("login.capsLock")}
            </>
          )}
        </p>
      </Field>
      {error && (
        <div id="login-error">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("login.submit")}
      </Button>
    </form>
  );
}
