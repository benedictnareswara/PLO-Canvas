import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { BarChart3, Check, Target } from "lucide-react";
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

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-linear-to-br from-(--landing-from) to-(--landing-to)">
      {/* Soft colour blobs behind the content, in the logo's cyan and navy. */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 -z-10 size-[28rem] rounded-full bg-accent/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-40 bottom-0 -z-10 size-[34rem] rounded-full bg-brand/15 blur-3xl" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))] lg:px-12">
        <BrandLogo className="h-14 sm:h-16" label="The American University of Indonesia" />
        <LanguageSwitcher />
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-6 py-10 lg:grid-cols-[26rem_minmax(0,1fr)] lg:gap-16 lg:px-12">
        <section
          aria-labelledby="login-title"
          className="rounded-[2rem] border border-surface/60 bg-surface/80 p-8 shadow-e3 backdrop-blur-md motion-safe:animate-fade-up sm:p-10"
        >
          <p className="text-sm font-bold text-highlight">
            {t("common.appName")} · {t("common.registry")}
          </p>
          <h1 id="login-title" className="mt-2 text-3xl font-bold">
            {t("login.title")}
          </h1>
          <p className="mt-1.5 mb-7 text-sm text-muted">{t("login.subtitle")}</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </section>

        <section className="hidden lg:block">
          <h2 className="max-w-xl text-4xl leading-[1.1] font-bold text-brand">{t("login.heroTitle")}</h2>
          <p className="mt-4 max-w-lg text-base text-muted">{t("login.heroBody")}</p>
          <ul className="mt-6 flex max-w-xl flex-wrap gap-2">
            {points.map((p) => (
              <li key={p} className="inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1.5 text-sm shadow-e1">
                <Check className="size-3.5 text-ok" aria-hidden />
                {p}
              </li>
            ))}
          </ul>

          <div className="relative mt-10 ml-auto w-full max-w-lg">
            <div className="overflow-hidden rounded-[2rem] shadow-e3 ring-1 ring-border">
              <Image src="/brand/campus-students.jpg" alt="" width={1400} height={949} priority sizes="32rem" className="h-auto w-full" />
            </div>
            <div className="absolute bottom-10 -left-14 flex items-center gap-4 rounded-2xl border-2 border-dashed border-brand bg-surface px-5 py-4 shadow-e2 motion-safe:animate-float">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-(--brand-grad-from) to-(--brand-grad-to) text-brand-fg">
                <Target className="size-7" aria-hidden />
              </span>
              <div>
                <div className="text-xl leading-tight font-bold">{t("login.statTitle")}</div>
                <div className="text-sm text-muted">{t("login.statBody")}</div>
              </div>
            </div>
            <div className="absolute top-14 -right-5 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-highlight to-[color-mix(in_oklab,var(--highlight),var(--warn)_45%)] text-solid-fg shadow-e2 [animation-delay:-3s] motion-safe:animate-float">
              <BarChart3 className="size-8" aria-hidden />
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted">{t("login.footer")}</footer>
    </div>
  );
}
