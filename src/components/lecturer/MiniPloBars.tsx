import { isAtRisk } from "@/lib/obe/engine";
import { cn } from "@/components/ui";

/**
 * Small bar strip of class-mean PLO attainment against the target line. Decorative summary only:
 * the exact values are in the accessible label and on the class page.
 */
export function MiniPloBars({
  values,
  threshold,
  label,
  noData,
}: {
  values: { code: string; value: number | null }[];
  threshold: number;
  label: string;
  noData: string;
}) {
  if (!values.length) return null;
  const description = values.map((v) => `${v.code} ${v.value === null ? noData : `${v.value.toFixed(1)}%`}`).join(", ");
  return (
    <div role="img" aria-label={`${label}: ${description}`} className="relative flex h-12 items-end gap-1.5">
      <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: `${threshold}%` }} />
      {values.map((v) => (
        <span key={v.code} aria-hidden className="flex h-full w-5 flex-col items-center justify-end" title={`${v.code}: ${v.value === null ? noData : `${v.value.toFixed(1)}%`}`}>
          <span
            className={cn(
              "w-full rounded-t-sm",
              v.value === null ? "h-0.5 bg-border-strong" : isAtRisk(v.value, threshold) ? "bg-risk" : "bg-ok",
            )}
            style={v.value === null ? undefined : { height: `${Math.max(4, v.value)}%` }}
          />
        </span>
      ))}
    </div>
  );
}
