"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
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
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { PloInfo, PloValues } from "@/lib/obe/types";
import { AtRiskBadge, formatPct } from "@/components/AtRiskBadge";
import { Table, Td, Th, cn } from "@/components/ui";
import { SERIES, TARGET_COLOR, type MarkerShape } from "./series";

export { SERIES_COLORS } from "./series";

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

/** SVG marker for a series (also drawn in the legend). */
function Marker({ shape, x, y, r, color }: { shape: MarkerShape; x: number; y: number; r: number; color: string }) {
  const stroke = { fill: color, stroke: "var(--surface)", strokeWidth: 1.5 };
  if (shape === "square") return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...stroke} />;
  if (shape === "triangle") return <polygon points={`${x},${y - r * 1.2} ${x + r * 1.1},${y + r * 0.8} ${x - r * 1.1},${y + r * 0.8}`} {...stroke} />;
  return <circle cx={x} cy={y} r={r} {...stroke} />;
}

function RadarTooltip({
  active,
  payload,
  series,
  threshold,
}: Partial<TooltipContentProps<number, string>> & { series: RadarSeries[]; threshold: number }) {
  const t = useTranslations("radar");
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload as Datum;
  return (
    <div className="max-w-72 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-e3">
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
                <svg width="10" height="10" aria-hidden>
                  <Marker shape={SERIES[i].marker} x={5} y={5} r={4} color={SERIES[i].color} />
                </svg>
                {s.label}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-foreground tabular">
                {raw === null ? <span className="text-muted">{t("noEvidence")}</span> : formatPct(raw)}
                {isAtRisk(raw, threshold) && <AlertTriangle className="size-3.5 text-risk" aria-label={t("atRisk")} />}
              </span>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1 text-muted">
          <span>{t("target")}</span>
          <span className="tabular">{formatPct(threshold)}</span>
        </div>
      </div>
    </div>
  );
}

/** Axis label with the PLO description as a native tooltip (SVG <title>). */
function AngleTick({ x, y, payload, textAnchor, plos }: { x?: number; y?: number; payload?: { value: string }; textAnchor?: string; plos: PloInfo[] }) {
  const plo = plos.find((p) => p.code === payload?.value);
  return (
    <text x={x} y={y} textAnchor={textAnchor as "start" | "middle" | "end"} dominantBaseline="central" fill="var(--chart-axis)" fontSize={12} fontWeight={600}>
      {plo && <title>{`${plo.code}: ${plo.description}`}</title>}
      {payload?.value}
    </text>
  );
}

/**
 * PLO spider chart. Series differ by colour, dash and marker; the legend focuses a series; values
 * morph between periods (off under reduced motion); an equivalent table is available below.
 * Missing evidence is drawn at the centre and called out in text, never counted as at-risk.
 */
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
  const t = useTranslations("radar");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  const [focus, setFocus] = useState<string | null>(null);
  const shown = series.slice(0, SERIES.length);
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
  const dim = (key: string) => focus !== null && focus !== key;

  return (
    <div>
      <div style={{ height }} className="w-full" role="img" aria-label={t("chartLabel", { series: shown.map((s) => s.label).join(", ") })}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid gridType="polygon" stroke="var(--chart-grid)" />
            <PolarAngleAxis dataKey="axis" tick={<AngleTick plos={plos} />} />
            <PolarRadiusAxis
              domain={[0, 100]}
              tickCount={6}
              angle={72}
              tick={{ fill: "var(--chart-tick)", fontSize: 10 }}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Radar
              name={t("targetLine", { value: threshold })}
              dataKey="target"
              stroke={TARGET_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
            {shown.map((s, i) => {
              const style = SERIES[i];
              return (
                <Radar
                  key={s.key}
                  name={s.label}
                  dataKey={s.key}
                  stroke={style.color}
                  strokeWidth={focus === s.key ? 2.75 : 2}
                  strokeDasharray={style.dash}
                  strokeOpacity={dim(s.key) ? 0.25 : 1}
                  fill={style.color}
                  fillOpacity={dim(s.key) ? 0.03 : shown.length > 1 ? 0.1 : 0.2}
                  dot={(props: { cx?: number; cy?: number; index?: number }) => (
                    <Marker key={`${s.key}-${props.index}`} shape={style.marker} x={props.cx ?? 0} y={props.cy ?? 0} r={dim(s.key) ? 2.5 : 3.5} color={style.color} />
                  )}
                  isAnimationActive={!reducedMotion}
                  animationDuration={240}
                  animationEasing="ease-out"
                />
              );
            })}
            <Tooltip content={<RadarTooltip series={shown} threshold={threshold} />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs" aria-label={t("legend")}>
        {shown.map((s, i) => {
          const style = SERIES[i];
          return (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={focus === s.key}
                onClick={() => setFocus((f) => (f === s.key ? null : s.key))}
                className={cn(
                  "flex items-center gap-1.5 rounded px-1.5 py-1 text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand",
                  dim(s.key) && "opacity-50",
                )}
                title={shown.length > 1 ? t("focusHint") : undefined}
                disabled={shown.length < 2}
              >
                <svg width="26" height="10" aria-hidden>
                  <line x1="1" y1="5" x2="25" y2="5" stroke={style.color} strokeWidth="2" strokeDasharray={style.dash} />
                  <Marker shape={style.marker} x={13} y={5} r={3.5} color={style.color} />
                </svg>
                {s.label}
              </button>
            </li>
          );
        })}
        <li className="flex items-center gap-1.5 px-1.5 text-muted">
          <svg width="26" height="10" aria-hidden>
            <line x1="1" y1="5" x2="25" y2="5" stroke={TARGET_COLOR} strokeWidth="1.5" strokeDasharray="6 4" />
          </svg>
          {t("targetLine", { value: threshold })}
        </li>
      </ul>

      {missing.length > 0 && <p className="mt-1 text-center text-xs text-muted">{t("missing", { list: missing.join("; ") })}</p>}
      {showTable && <PloValuesTable plos={plos} series={shown} threshold={threshold} />}
    </div>
  );
}

/** Accessible table view of the same numbers shown on the radar. */
export function PloValuesTable({ plos, series, threshold }: { plos: PloInfo[]; series: RadarSeries[]; threshold: number }) {
  const t = useTranslations("radar");
  return (
    <details className="mt-3 rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted hover:text-foreground">{t("showTable")}</summary>
      <Table label={t("tableLabel")}>
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
