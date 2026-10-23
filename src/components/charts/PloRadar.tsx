"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { isAtRisk } from "@/lib/obe/engine";
import type { PloInfo, PloValues } from "@/lib/obe/types";
import { AtRiskBadge, formatPct } from "@/components/AtRiskBadge";
import { Table, Td, Th } from "@/components/ui";

/**
 * Validated categorical slots (blue, orange, aqua) — the first three pass all-pairs
 * CVD separation; a radar overlay is capped at three series.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];
const TARGET_COLOR = "#52514e";

export interface RadarSeries {
  key: string;
  label: string;
  values: PloValues;
}

interface Datum {
  axis: string;
  plo: PloInfo;
  target: number;
  [series: string]: number | string | PloInfo | null;
}

function RadarTooltip({
  active,
  payload,
  series,
  threshold,
}: Partial<TooltipContentProps<number, string>> & { series: RadarSeries[]; threshold: number }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload as Datum;
  return (
    <div className="max-w-72 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-foreground">
        {datum.plo.code} · {datum.plo.shortLabel}
      </div>
      <p className="mt-0.5 text-muted">{datum.plo.description}</p>
      <div className="mt-2 space-y-1">
        {series.map((s, i) => {
          const raw = datum[`raw_${s.key}`] as number | null;
          return (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-foreground">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
                {s.label}
              </span>
              <span className="flex items-center gap-1.5 tabular font-medium text-foreground">
                {raw === null ? <span className="text-muted">No evidence yet</span> : formatPct(raw)}
                {isAtRisk(raw, threshold) && <AlertTriangle className="size-3.5 text-risk" aria-label="At-risk" />}
              </span>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1 text-muted">
          <span>Target (passing line)</span>
          <span className="tabular">{formatPct(threshold)}</span>
        </div>
      </div>
    </div>
  );
}

export function PloRadar({
  plos,
  series,
  threshold,
  height = 400,
  showTable = true,
}: {
  plos: PloInfo[];
  series: RadarSeries[];
  threshold: number;
  height?: number;
  showTable?: boolean;
}) {
  const shown = series.slice(0, SERIES_COLORS.length);
  const data: Datum[] = plos.map((plo) => {
    const d: Datum = { axis: plo.code, plo, target: threshold };
    for (const s of shown) {
      const v = s.values[plo.number] ?? null;
      d[`raw_${s.key}`] = v;
      d[s.key] = v ?? 0; // plotted at the centre; the tooltip and table say "no evidence"
    }
    return d;
  });
  const missing = shown.flatMap((s) => {
    const empty = plos.filter((p) => (s.values[p.number] ?? null) === null).map((p) => p.code);
    if (!empty.length) return [];
    return [shown.length > 1 ? `${empty.join(", ")} (${s.label})` : empty.join(", ")];
  });

  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid gridType="polygon" stroke="#d9dce1" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "#3b4250", fontSize: 12, fontWeight: 600 }} />
            <PolarRadiusAxis
              domain={[0, 100]}
              tickCount={6}
              angle={72}
              tick={{ fill: "#7b8391", fontSize: 10 }}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            {shown.map((s, i) => (
              <Radar
                key={s.key}
                name={s.label}
                dataKey={s.key}
                stroke={SERIES_COLORS[i]}
                strokeWidth={2}
                fill={SERIES_COLORS[i]}
                fillOpacity={shown.length > 1 ? 0.12 : 0.22}
                dot={{ r: 3.5, fill: SERIES_COLORS[i], stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            ))}
            <Radar
              name={`Target (${threshold}%)`}
              dataKey="target"
              stroke={TARGET_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip content={<RadarTooltip series={shown} threshold={threshold} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#3b4250" }} iconType="plainline" />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {missing.length > 0 && (
        <p className="mt-1 text-center text-xs text-muted">
          No evidence yet for {missing.join(", ")}: drawn at the centre, not counted as at-risk.
        </p>
      )}
      {showTable && <PloValuesTable plos={plos} series={shown} threshold={threshold} />}
    </div>
  );
}

/** Accessible table view of the same numbers shown on the radar. */
export function PloValuesTable({ plos, series, threshold }: { plos: PloInfo[]; series: RadarSeries[]; threshold: number }) {
  return (
    <details className="mt-3 rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted">Show values as table</summary>
      <Table>
        <thead>
          <tr>
            <Th>PLO</Th>
            {series.map((s) => (
              <Th key={s.key} className="text-right">
                {s.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plos.map((p) => (
            <tr key={p.id}>
              <Td title={p.description}>
                <span className="font-medium">{p.code}</span> <span className="text-muted">{p.shortLabel}</span>
              </Td>
              {series.map((s) => (
                <Td key={s.key} className="text-right">
                  <AtRiskBadge value={s.values[p.number] ?? null} threshold={threshold} />
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </details>
  );
}
