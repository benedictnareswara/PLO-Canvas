import Link from "next/link";
import type { getTranslations } from "next-intl/server";
import { ClipboardList, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { BrandMark } from "@/components/BrandMark";
import { MiniPloBars } from "@/components/lecturer/MiniPloBars";
import { atRiskPlos } from "@/lib/obe/aggregate";
import type { OfferingListItem } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";

/** Banner colours for the course cards, all from the AUI palette. A class always gets the same colour. */
const BANNERS = Array.from({ length: 8 }, (_, i) => `var(--banner-${i + 1})`);
function bannerFor(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BANNERS[h % BANNERS.length];
}

/** A Canvas-style course card: coloured banner, course title, code and term, then the PLO strip. */
export function ClassCard({ offering: o, plos, t }: { offering: OfferingListItem; plos: PloInfo[]; t: Awaited<ReturnType<typeof getTranslations<"classes">>> }) {
  const risky = atRiskPlos(o.plo, o.threshold).length;
  const mapped = (o.coursePloNumbers.length ? o.coursePloNumbers : plos.filter((p) => o.plo[p.number] !== null).map((p) => p.number)).map((n) => ({
    code: plos.find((p) => p.number === n)?.code ?? `PLO ${n}`,
    value: o.plo[n] ?? null,
  }));
  return (
    <Link
      href={`/lecturer/offerings/${o.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface shadow-e1 transition-shadow duration-(--dur-2) hover:shadow-e2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="relative h-24 shrink-0 overflow-hidden" style={{ background: bannerFor(o.code) }}>
        <BrandMark tone="onBrand" className="pointer-events-none absolute -right-4 -bottom-8 h-36 opacity-20 brightness-0 invert" />
        <div className="absolute top-2.5 right-2.5">
          {risky ? (
            <Badge tone="risk">{t("atRisk", { count: risky })}</Badge>
          ) : o.assessmentCount ? (
            <Badge tone="ok">{t("onTarget")}</Badge>
          ) : (
            <Badge>{t("pending")}</Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="min-w-0">
          <div className="truncate font-bold text-brand group-hover:underline">{o.title}</div>
          <div className="mt-0.5 text-sm text-muted">{o.code}</div>
          <div className="text-xs text-muted uppercase">{o.period}</div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted tabular">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {o.studentCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClipboardList className="size-3.5" aria-hidden />
            {o.assessmentCount}
          </span>
          <span>{t("cardTarget", { target: o.threshold })}</span>
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
      </div>
    </Link>
  );
}
