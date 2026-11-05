import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowRight, ClipboardList, Library, Target } from "lucide-react";
import { requirePageUser } from "@/lib/auth/rbac";
import { listOfferings, type OfferingListItem } from "@/lib/obe/queries";
import { atRiskPlos } from "@/lib/obe/aggregate";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ClassesTable } from "@/components/lecturer/ClassesTable";
import { MiniPloBars } from "@/components/lecturer/MiniPloBars";
import type { PloInfo } from "@/lib/obe/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("myClasses") };
}

interface Attention {
  key: string;
  icon: "assessments" | "unmeasured" | "risk";
  text: string;
  href: string;
  action: string;
}

export default async function LecturerHome() {
  const user = await requirePageUser("lecturer", "faculty_head");
  const t = await getTranslations("classes");
  const { offerings, plos } = await listOfferings({ lecturer: user.id });
  const currentKey = offerings[0] ? `${offerings[0].academicYear}-${offerings[0].term}` : null;
  const current = offerings.filter((o) => `${o.academicYear}-${o.term}` === currentKey);
  const ploCode = new Map(plos.map((p) => [p.number, p.code]));
  const code = (n: number) => ploCode.get(n) ?? `PLO ${n}`;

  // Actionable items for this term only: past terms can't be fixed any more.
  const attention: Attention[] = current.flatMap((o) => {
    const href = `/lecturer/offerings/${o.id}`;
    if (!o.assessmentCount) {
      return [{ key: `${o.id}-a`, icon: "assessments" as const, text: t("attention.noAssessments", { course: o.code }), href: `${href}?tab=assessments`, action: t("attention.addAssessments") }];
    }
    const items: Attention[] = [];
    const unmeasured = o.coursePloNumbers.filter((n) => o.plo[n] === null);
    if (unmeasured.length) {
      items.push({
        key: `${o.id}-u`,
        icon: "unmeasured",
        text: t("attention.unmeasured", { course: o.code, list: unmeasured.map(code).join(", "), count: unmeasured.length }),
        href: `${href}?tab=assessments`,
        action: t("attention.review"),
      });
    }
    const risky = atRiskPlos(o.plo, o.threshold);
    if (risky.length) {
      items.push({
        key: `${o.id}-r`,
        icon: "risk",
        text: t("attention.belowTarget", { course: o.code, list: risky.map(code).join(", "), count: risky.length, target: o.threshold }),
        href: `${href}?tab=radar`,
        action: t("attention.open"),
      });
    }
    return items;
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {offerings.length === 0 ? (
        <EmptyState icon={<Library />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="space-y-8">
          {attention.length > 0 && (
            <Card>
              <CardHeader title={t("attention.title")} description={t("attention.description", { count: attention.length })} />
              <ul className="divide-y divide-border">
                {attention.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className="group flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
                      <span
                        className={
                          a.icon === "risk"
                            ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-risk-soft text-risk"
                            : "flex size-7 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn"
                        }
                        aria-hidden
                      >
                        {a.icon === "risk" ? <AlertTriangle className="size-3.5" /> : a.icon === "assessments" ? <ClipboardList className="size-3.5" /> : <Target className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">{a.text}</span>
                      <span className="hidden items-center gap-1 text-xs font-medium text-brand sm:flex">
                        {a.action}
                        <ArrowRight className="size-3.5 transition-transform duration-(--dur-1) group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section aria-labelledby="current-term">
            <h2 id="current-term" className="mb-3 flex items-baseline gap-2 text-base font-semibold">
              {t("currentTerm")}
              <span className="text-sm font-normal text-muted">{current[0]?.period}</span>
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {current.map((o) => (
                <li key={o.id}>
                  <ClassCard offering={o} plos={plos} t={t} />
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="all-classes">
            <h2 id="all-classes" className="mb-3 text-base font-semibold">
              {t("allTitle")}
            </h2>
            <Card>
              <ClassesTable offerings={offerings} plos={plos} />
            </Card>
          </section>
        </div>
      )}
    </>
  );
}

function ClassCard({ offering: o, plos, t }: { offering: OfferingListItem; plos: PloInfo[]; t: Awaited<ReturnType<typeof getTranslations<"classes">>> }) {
  const risky = atRiskPlos(o.plo, o.threshold).length;
  const mapped = (o.coursePloNumbers.length ? o.coursePloNumbers : plos.filter((p) => o.plo[p.number] !== null).map((p) => p.number)).map((n) => ({
    code: plos.find((p) => p.number === n)?.code ?? `PLO ${n}`,
    value: o.plo[n] ?? null,
  }));
  return (
    <Link
      href={`/lecturer/offerings/${o.id}`}
      className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-e1 transition-[border-color,box-shadow] duration-(--dur-2) hover:border-border-strong hover:shadow-e2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{o.code}</div>
          <div className="truncate font-semibold">{o.title}</div>
        </div>
        {risky ? (
          <Badge tone="risk">{t("atRisk", { count: risky })}</Badge>
        ) : o.assessmentCount ? (
          <Badge tone="ok">{t("onTarget")}</Badge>
        ) : (
          <Badge>{t("pending")}</Badge>
        )}
      </div>
      <div className="mt-1 text-xs text-muted tabular">
        {t("cardMeta", { students: o.studentCount, assessments: o.assessmentCount, target: o.threshold })}
      </div>
      <div className="mt-auto pt-4">
        {o.assessmentCount ? (
          <>
            <MiniPloBars values={mapped} threshold={o.threshold} label={t("miniChart")} noData={t("noEvidence")} />
            <div className="mt-1 flex gap-1.5 text-[0.625rem] text-muted" aria-hidden>
              {mapped.map((m) => (
                <span key={m.code} className="w-5 text-center">
                  {m.code.replace(/\D/g, "")}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">{t("noAssessments")}</p>
        )}
      </div>
    </Link>
  );
}
