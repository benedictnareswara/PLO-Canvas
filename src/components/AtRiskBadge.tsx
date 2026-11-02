import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { isAtRisk } from "@/lib/obe/engine";
import { Badge } from "@/components/ui";

export function formatPct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}%`;
}

/** Value with a status badge: red "At-Risk" below the threshold, green "Met" otherwise. */
export function AtRiskBadge({
  value,
  threshold,
  compact = false,
}: {
  value: number | null;
  threshold: number;
  compact?: boolean;
}) {
  const t = useTranslations("status");
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  const risk = isAtRisk(value, threshold);
  return (
    <span className="inline-flex items-center justify-end gap-2 tabular">
      <span className={risk ? "font-semibold text-risk" : undefined}>{formatPct(value)}</span>
      {risk ? (
        <Badge tone="risk">
          <AlertTriangle className="size-3" aria-hidden />
          {compact ? <span className="sr-only">{t("atRisk")}</span> : t("atRisk")}
        </Badge>
      ) : (
        !compact && (
          <Badge tone="ok">
            <CheckCircle2 className="size-3" aria-hidden />
            {t("met")}
          </Badge>
        )
      )}
    </span>
  );
}

/** Heatmap-style cell for PLO matrices. */
export function PloCell({ value, threshold }: { value: number | null; threshold: number }) {
  const t = useTranslations("status");
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  const risk = isAtRisk(value, threshold);
  return (
    <span
      title={risk ? t("belowTarget", { target: threshold }) : t("meetsTarget", { target: threshold })}
      className={
        "inline-flex min-w-14 items-center justify-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tabular " +
        (risk ? "bg-risk-soft text-risk ring-1 ring-risk/30" : "bg-ok-soft text-ok")
      }
    >
      {risk && <AlertTriangle className="size-3" aria-label={t("atRisk")} />}
      {value.toFixed(1)}
    </span>
  );
}
