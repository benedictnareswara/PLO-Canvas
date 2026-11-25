import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Check } from "lucide-react";
import { BrandLogo } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations();
  const points = [t("login.point1"), t("login.point2"), t("login.point3")];
  const subtitle = t("common.registry");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand field in AUI navy: the starburst is cropped off the corner as a faint white texture, so the
          panel carries the identity without competing with the sign-in form. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r-[6px] border-accent bg-brand-panel px-12 py-10 text-brand-panel-fg lg:flex">
        <Image
          src="/brand/aui-mark-dark.png"
          alt=""
          width={240}
          height={376}
          priority
          className="pointer-events-none absolute -right-32 -bottom-40 h-[38rem] w-auto max-w-none opacity-15 brightness-0 invert select-none"
        />
        <div className="relative">
          <BrandLogo tone="onBrand" className="h-24" label="The American University of Indonesia" />
          <div className="mt-5 text-lg font-bold">
            {t("common.appName")} <span className="font-normal opacity-80">· {t("common.registry")}</span>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-[2rem] leading-tight font-bold">{t("login.heroTitle")}</h2>
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
              <BrandLogo className="h-12" label="The American University of Indonesia" />
              <div className="border-l border-border-strong pl-3">
                <div className="text-base leading-tight font-bold text-brand">{t("common.appName")}</div>
                <div className="text-xs text-muted">{subtitle}</div>
              </div>
            </div>
            <h1 className="text-2xl font-bold">{t("login.title")}</h1>
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
