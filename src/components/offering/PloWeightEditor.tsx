"use client";

import { Badge, Button, Input, cn } from "@/components/ui";
import type { PloInfo } from "@/lib/obe/types";

export interface WeightValue {
  plo: string;
  weight: number;
}

/**
 * Checkbox + weight input per PLO. `requireTotal100` enforces the per-assessment split
 * convention used by the Canvas wizard (e.g. 60% PLO 4 / 40% PLO 7).
 */
export function PloWeightEditor({
  plos,
  value,
  onChange,
  highlight = [],
  requireTotal100 = false,
  compact = false,
}: {
  plos: PloInfo[];
  value: WeightValue[];
  onChange: (v: WeightValue[]) => void;
  highlight?: number[];
  requireTotal100?: boolean;
  compact?: boolean;
}) {
  const byPlo = new Map(value.map((v) => [v.plo, v.weight]));
  const total = value.reduce((s, v) => s + (Number.isFinite(v.weight) ? v.weight : 0), 0);
  const totalOk = !requireTotal100 || Math.abs(total - 100) < 0.01;

  function toggle(plo: string, on: boolean) {
    if (on) onChange([...value, { plo, weight: 0 }]);
    else onChange(value.filter((v) => v.plo !== plo));
  }
  function setWeight(plo: string, weight: number) {
    onChange(value.map((v) => (v.plo === plo ? { ...v, weight } : v)));
  }
  function splitEvenly() {
    if (!value.length) return;
    const base = Math.floor((100 / value.length) * 100) / 100;
    onChange(value.map((v, i) => ({ ...v, weight: i === 0 ? Math.round((100 - base * (value.length - 1)) * 100) / 100 : base })));
  }

  return (
    <div>
      <div className={cn("grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        {plos.map((p) => {
          const checked = byPlo.has(p.id);
          return (
            <label
              key={p.id}
              title={p.description}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm",
                checked ? "border-brand/40 bg-brand-soft/60" : "border-border",
              )}
            >
              <input type="checkbox" checked={checked} onChange={(e) => toggle(p.id, e.target.checked)} className="accent-brand" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{p.code}</span>
                {!compact && <span className="ml-1 truncate text-xs text-muted">{p.shortLabel}</span>}
                {highlight.includes(p.number) && !compact && (
                  <Badge tone="info" className="ml-1">
                    course PLO
                  </Badge>
                )}
              </span>
              {checked && (
                <span className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    aria-label={`${p.code} weight`}
                    className="h-7 w-16 px-1.5 text-right"
                    value={Number.isFinite(byPlo.get(p.id)) ? byPlo.get(p.id) : ""}
                    onChange={(e) => setWeight(p.id, e.target.value === "" ? NaN : Number(e.target.value))}
                  />
                  <span className="text-xs text-muted">%</span>
                </span>
              )}
            </label>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={cn("tabular", totalOk ? "text-muted" : "font-medium text-risk")}>
          {value.length} PLO{value.length === 1 ? "" : "s"} selected · total {Math.round(total * 100) / 100}%
          {requireTotal100 && !totalOk && " (must equal 100%)"}
        </span>
        {value.length > 1 && (
          <Button type="button" size="sm" variant="ghost" onClick={splitEvenly}>
            Split evenly
          </Button>
        )}
      </div>
    </div>
  );
}
