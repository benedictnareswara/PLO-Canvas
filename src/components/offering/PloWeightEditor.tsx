"use client";

import { useTranslations } from "next-intl";
import { Badge, Button, NumberInput, cn } from "@/components/ui";
import { parseScore } from "@/lib/gradebook/parse-score";
import type { PloInfo } from "@/lib/obe/types";

export interface WeightValue {
  plo: string;
  weight: number;
}

/** Splits 100% evenly across n PLOs, giving the rounding remainder to the first. */
export function splitEvenly(plos: string[]): WeightValue[] {
  if (!plos.length) return [];
  const base = Math.floor((100 / plos.length) * 100) / 100;
  return plos.map((plo, i) => ({ plo, weight: i === 0 ? Math.round((100 - base * (plos.length - 1)) * 100) / 100 : base }));
}

/**
 * Checkbox per PLO; a checked PLO gets a slider paired with a number field (the slider for quick
 * coarse changes, the field for exact values). `requireTotal100` enforces the per-assessment split
 * convention used by the Canvas wizard (e.g. 60% PLO 4 / 40% PLO 7).
 */
export function PloWeightEditor({
  plos,
  value,
  onChange,
  highlight = [],
  requireTotal100 = false,
  invalid = false,
  describedBy,
}: {
  plos: PloInfo[];
  value: WeightValue[];
  onChange: (v: WeightValue[]) => void;
  highlight?: number[];
  requireTotal100?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("weights");
  const byPlo = new Map(value.map((v) => [v.plo, v.weight]));
  const total = value.reduce((s, v) => s + (Number.isFinite(v.weight) ? v.weight : 0), 0);
  const totalOk = !requireTotal100 || Math.abs(total - 100) < 0.01;

  function toggle(plo: string, on: boolean) {
    // Re-split evenly when adding, so the common case needs no typing.
    if (on) onChange(value.length ? [...value, { plo, weight: 0 }] : [{ plo, weight: 100 }]);
    else onChange(value.filter((v) => v.plo !== plo));
  }
  function setWeight(plo: string, weight: number) {
    onChange(value.map((v) => (v.plo === plo ? { ...v, weight } : v)));
  }

  // Course PLOs first: they're the ones the curriculum expects this course to assess.
  const ordered = [...plos].sort((a, b) => Number(!highlight.includes(a.number)) - Number(!highlight.includes(b.number)) || a.number - b.number);

  return (
    <div aria-describedby={describedBy}>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ordered.map((p) => {
          const checked = byPlo.has(p.id);
          const weight = byPlo.get(p.id);
          return (
            <div
              key={p.id}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-sm transition-colors duration-(--dur-1)",
                checked ? "border-brand/40 bg-brand-soft/50" : "border-border",
                checked && invalid && !(weight! > 0) && "border-risk/50",
              )}
            >
              <label className="flex cursor-pointer items-center gap-2" title={p.description}>
                <input type="checkbox" checked={checked} onChange={(e) => toggle(p.id, e.target.checked)} className="size-4 accent-brand" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{p.code}</span>
                  <span className="ml-1.5 text-xs text-muted">{p.shortLabel}</span>
                </span>
                {highlight.includes(p.number) && <Badge tone="info">{t("coursePlo")}</Badge>}
              </label>
              {checked && (
                <div className="mt-2 flex items-center gap-2 pl-6">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Number.isFinite(weight) ? weight : 0}
                    onChange={(e) => setWeight(p.id, Number(e.target.value))}
                    aria-label={t("weightFor", { plo: p.code })}
                    className="h-6 min-w-0 flex-1 accent-brand"
                  />
                  <NumberInput
                    aria-label={t("weightFor", { plo: p.code })}
                    className="h-8 w-16 px-2"
                    value={Number.isFinite(weight) ? String(weight) : ""}
                    onChange={(e) => {
                      const n = parseScore(e.target.value);
                      setWeight(p.id, n === null ? NaN : n);
                    }}
                  />
                  <span className="text-xs text-muted">%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={cn("tabular", totalOk ? "text-muted" : "font-medium text-risk")}>
          {t("summary", { count: value.length, total: Math.round(total * 100) / 100 })}
          {requireTotal100 && !totalOk && ` · ${t("mustBe100")}`}
        </span>
        {value.length > 1 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(splitEvenly(value.map((v) => v.plo)))}>
            {t("splitEvenly")}
          </Button>
        )}
      </div>
    </div>
  );
}
