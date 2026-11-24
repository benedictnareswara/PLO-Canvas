import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Check } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations();
  const points = [t("login.point1"), t("login.point2"), t("login.point3")];
  const subtitle = `${t("common.university")} · ${t("common.registry")}`;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand field in Sampoerna navy: the starburst is cropped off the corner as texture, so the
          panel carries the identity without competing with the sign-in form. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-panel px-12 py-10 text-brand-panel-fg lg:flex">
        <Image
          src="/brand/su-mark-on-brand.png"
          alt=""
          width={640}
          height={786}
          priority
          className="pointer-events-none absolute -right-40 -bottom-48 w-[36rem] max-w-none opacity-20 select-none"
        />
        <div className="relative flex items-center gap-3">
          <Image src="/brand/su-mark-on-brand.png" alt="" width={640} height={786} className="h-10 w-auto" />
          <div>
            <div className="text-base leading-tight font-semibold">{t("common.appName")}</div>
            <div className="text-xs opacity-80">{subtitle}</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-[2rem] leading-tight font-semibold">{t("login.heroTitle")}</h2>
          <p className="mt-4 text-[0.9375rem] opacity-85">{t("login.heroBody")}</p>
          <ul className="mt-8 space-y-3 text-sm">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-panel-fg/15">
                  <Check className="size-3" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs opacity-75">{t("login.footer")}</p>
      </aside>

      <main className="flex flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <BrandMark className="h-10" />
              <div>
                <div className="text-base leading-tight font-semibold">{t("common.appName")}</div>
                <div className="text-xs text-muted">{subtitle}</div>
              </div>
            </div>
            <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
            <p className="mt-1.5 mb-8 text-sm text-muted">{t("login.subtitle")}</p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
