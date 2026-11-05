import Link from "next/link";
import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { PrintButton } from "./PrintButton";

/**
 * A4 report page: a sheet on screen with a toolbar (back, print), and a clean page when printed or
 * saved as PDF. The header names the institution, the report, when it was generated and by whom.
 */
export async function ReportShell({
  title,
  subtitle,
  backHref,
  generatedBy,
  children,
}: {
  title: string;
  subtitle: string;
  backHref: string;
  generatedBy: string;
  children: ReactNode;
}) {
  const t = await getTranslations("reports");
  const format = await getFormatter();
  const now = new Date();
  return (
    <div className="min-h-dvh bg-background py-6 print:bg-surface print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {t("back")}
        </Link>
        <PrintButton label={t("print")} />
      </div>
      <main className="report mx-auto max-w-[210mm] bg-surface px-[14mm] py-[12mm] shadow-e2 print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-foreground pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand text-brand-fg print:border print:border-foreground print:bg-transparent print:text-foreground">
              <GraduationCap className="size-5" aria-hidden />
            </div>
            <div>
              <div className="text-sm font-semibold">{t("university")}</div>
              <div className="text-xs text-muted">{t("registry")}</div>
            </div>
          </div>
          <div className="text-right text-xs text-muted">
            <div>{t("generatedAt", { date: format.dateTime(now, { dateStyle: "long", timeStyle: "short" }) })}</div>
            <div>{t("generatedBy", { name: generatedBy })}</div>
          </div>
        </header>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
        {children}
        <footer className="mt-8 border-t border-border pt-3 text-[0.6875rem] text-muted">{t("footer")}</footer>
      </main>
    </div>
  );
}

/** A titled block that prefers not to split across pages. */
export function ReportSection({ title, children, keepTogether = true }: { title: string; children: ReactNode; keepTogether?: boolean }) {
  return (
    <section className={keepTogether ? "mb-6 break-inside-avoid" : "mb-6"}>
      <h2 className="mb-2 text-sm font-semibold break-after-avoid">{title}</h2>
      {children}
    </section>
  );
}

/** Compact print table: repeated header row on every page, rows never split. */
export function ReportTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-xs [&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b-2 [&_th]:border-foreground/70 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_tr]:break-inside-avoid">
      <thead className="[display:table-header-group]">{head}</thead>
      <tbody>{children}</tbody>
    </table>
  );
}
