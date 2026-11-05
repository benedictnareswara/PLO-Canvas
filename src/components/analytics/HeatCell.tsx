import { AlertTriangle } from "lucide-react";
import { isAtRisk } from "@/lib/obe/engine";
import { cn } from "@/components/ui";

/**
 * Heatmap tint for an attainment value: stronger brand tint for higher values. Below-target cells
 * switch to the risk tone and get an icon, so the state never relies on colour alone, and the
 * number is always written. Tints stay light enough for body text in both themes.
 */
export function heatStyle(value: number, threshold: number): React.CSSProperties {
  const risk = isAtRisk(value, threshold);
  const strength = Math.round(6 + (Math.max(0, Math.min(100, value)) / 100) * 28);
  return { background: `color-mix(in oklab, var(${risk ? "--risk" : "--brand"}) ${risk ? 16 : strength}%, var(--surface))` };
}

export function HeatValue({ value, threshold, className }: { value: number | null; threshold: number; className?: string }) {
  if (value === null) return <span className="text-subtle">—</span>;
  const risk = isAtRisk(value, threshold);
  return (
    <span className={cn("inline-flex items-center justify-center gap-1 tabular", risk && "font-semibold text-risk", className)}>
      {risk && <AlertTriangle className="size-3 shrink-0" aria-hidden />}
      {value.toFixed(1)}
    </span>
  );
}

/** Legend for heatmapped matrices. */
export function HeatLegend({ low, high, below }: { low: string; high: string; below: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
      <span className="flex items-center gap-1.5">
        {low}
        <span className="h-2.5 w-24 rounded-sm" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--brand) 6%, var(--surface)), color-mix(in oklab, var(--brand) 34%, var(--surface)))" }} />
        {high}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-4 items-center gap-0.5 rounded-sm px-1 text-risk" style={{ background: "color-mix(in oklab, var(--risk) 16%, var(--surface))" }}>
          <AlertTriangle className="size-3" />
        </span>
        {below}
      </span>
    </div>
  );
}
