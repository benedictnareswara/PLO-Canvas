import type { ReactNode } from "react";
import { Card, Skeleton, cn } from "@/components/ui";

/**
 * Route-level loading placeholders shaped like the real pages, so nothing shifts when content
 * arrives. They fade in after 200ms (`.ui-delayed`): fast navigations show no skeleton at all
 * (NN/g: under ~1s, a loading indicator is more distracting than helpful).
 */
export function RouteSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="ui-delayed">
      <span className="sr-only">{label}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

export function PageHeaderSkeleton({ crumbs = false, action = false }: { crumbs?: boolean; action?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 basis-80 space-y-2.5">
        {crumbs && <Skeleton className="h-3.5 w-28" />}
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-40 rounded-lg" />}
    </div>
  );
}

export function SummaryStripSkeleton({ items = 4 }: { items?: number }) {
  return (
    <Card className={cn("mb-6 grid grid-cols-2", items >= 4 ? "lg:grid-cols-4" : "sm:grid-cols-3")}>
      {Array.from({ length: items }, (_, i) => (
        <div
          key={i}
          className={cn(
            "space-y-2 border-border px-5 py-4",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t",
            items >= 4 ? "lg:border-t-0 lg:[&:not(:first-child)]:border-l" : "sm:border-t-0 sm:[&:not(:first-child)]:border-l",
          )}
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-14" />
        </div>
      ))}
    </Card>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-6 border-b border-border bg-surface-2 px-5 py-2.5">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "w-40" : "w-16")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-border px-5 py-3.5 last:border-b-0">
          <div className="w-40 space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          {Array.from({ length: columns - 1 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-16" />
          ))}
        </div>
      ))}
    </Card>
  );
}

export function TabsSkeleton({ tabs = 4 }: { tabs?: number }) {
  return (
    <div className="mb-5 flex gap-4 border-b border-border pb-3">
      {Array.from({ length: tabs }, (_, i) => (
        <Skeleton key={i} className="h-4 w-20" />
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ height = 360 }: { height?: number }) {
  return (
    <Card>
      <div className="space-y-2 border-b border-border px-5 py-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="flex items-center justify-center p-5" style={{ height }}>
        <Skeleton className="aspect-square h-4/5 rounded-full opacity-60" />
      </div>
    </Card>
  );
}
