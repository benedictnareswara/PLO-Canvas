"use client";

import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { NumberInput, Select, cn } from "@/components/ui";
import { SegmentedControl } from "@/components/ui/client";
import { parseScore } from "@/lib/gradebook/parse-score";
import { urlNumber, useUrlState } from "@/lib/hooks/useUrlState";
import type { PeriodFilter } from "@/lib/obe/semesters";

const YEARS = ["all", "y1", "y2", "y3", "y4"] as const;
const SEMESTERS = Array.from({ length: 8 }, (_, i) => `s${i + 1}` as PeriodFilter);

function isPeriod(raw: string): raw is PeriodFilter {
  return (YEARS as readonly string[]).includes(raw) || /^s[1-9]\d?$/.test(raw);
}

/** Period and threshold what-if, kept in the URL (?period=y2&threshold=75) so views can be shared. */
export function useAnalyticsFilters(savedThreshold: number) {
  const [period, setPeriod] = useUrlState<PeriodFilter>("period", "all", { parse: (r) => (isPeriod(r) ? r : null) });
  const [threshold, setThreshold] = useUrlState<number>("threshold", savedThreshold, {
    parse: (r) => {
      const n = urlNumber.parse(r);
      return n !== null && n >= 0 && n <= 100 ? n : null;
    },
    serialize: urlNumber.serialize,
  });
  return { period, setPeriod, threshold, setThreshold, exploring: threshold !== savedThreshold };
}

/** All · Y1 · Y2 · Y3 · Y4 as a segmented control; single semesters in a select beside it. */
export function PeriodPicker({ value, onChange }: { value: PeriodFilter; onChange: (p: PeriodFilter) => void }) {
  const t = useTranslations("period");
  const isYear = (YEARS as readonly string[]).includes(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl<string>
        label={t("label")}
        value={isYear ? value : ""}
        onChange={(v) => onChange(v as PeriodFilter)}
        options={YEARS.map((y) => ({ value: y, label: <span title={y === "all" ? t("allLong") : t("yearLong", { n: y.slice(1) })}>{y === "all" ? t("all") : t("yearShort", { n: y.slice(1) })}</span> }))}
      />
      <Select
        value={isYear ? "" : value}
        onChange={(e) => onChange((e.target.value || "all") as PeriodFilter)}
        aria-label={t("semester")}
        className={cn(!isYear && "border-brand text-brand")}
      >
        <option value="">{t("semesterPlaceholder")}</option>
        {SEMESTERS.map((s) => (
          <option key={s} value={s}>
            {t("semesterN", { n: s.slice(1) })}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * What-if threshold. Labelled so nobody mistakes it for the saved target: while it differs, a
 * "Reset" chip says which value is saved.
 */
export function ThresholdWhatIf({ value, saved, onChange }: { value: number; saved: number; onChange: (v: number) => void }) {
  const t = useTranslations("analytics");
  const exploring = value !== saved;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="whatif" className="text-sm text-muted">
        {t("whatIf")}
      </label>
      <NumberInput
        id="whatif"
        className="w-20"
        value={String(value)}
        onChange={(e) => {
          const n = parseScore(e.target.value);
          if (n !== null && !Number.isNaN(n) && n >= 0 && n <= 100) onChange(n);
        }}
        aria-describedby="whatif-note"
      />
      <span className="text-sm text-muted">%</span>
      <span id="whatif-note" aria-live="polite" className="text-xs text-muted">
        {exploring ? t("exploring", { value, saved }) : t("savedTarget")}
      </span>
      {exploring && (
        <button
          type="button"
          onClick={() => onChange(saved)}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-warn/40 bg-warn-soft px-2.5 text-xs font-medium text-warn hover:border-warn focus-visible:outline-2 focus-visible:outline-brand"
        >
          <RotateCcw className="size-3" aria-hidden /> {t("resetTo", { value: saved })}
        </button>
      )}
    </div>
  );
}

/** One filter bar per page: a single surface above the content it filters. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-e1", className)}>{children}</div>;
}
