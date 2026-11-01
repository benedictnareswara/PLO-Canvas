import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Check, GraduationCap } from "lucide-react";
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
      {/* A quiet explanatory panel: what the tool does, in plain words. No imagery or gradients. */}
      <aside className="hidden flex-col justify-between border-r border-border bg-surface px-12 py-10 lg:flex">
        <Brand appName={t("common.appName")} subtitle={subtitle} />
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight">{t("login.heroTitle")}</h2>
          <p className="mt-3 text-sm text-muted">{t("login.heroBody")}</p>
          <ul className="mt-8 space-y-3 text-sm">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Check className="size-3" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">{t("login.footer")}</p>
      </aside>

      <main className="flex flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <Brand appName={t("common.appName")} subtitle={subtitle} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{t("login.title")}</h1>
            <p className="mt-1 mb-6 text-sm text-muted">{t("login.subtitle")}</p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

function Brand({ appName, subtitle }: { appName: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-brand text-brand-fg">
        <GraduationCap className="size-5" aria-hidden />
      </div>
      <div>
        <div className="text-base leading-tight font-semibold">{appName}</div>
        <div className="text-xs text-muted">{subtitle}</div>
      </div>
    </div>
  );
}
