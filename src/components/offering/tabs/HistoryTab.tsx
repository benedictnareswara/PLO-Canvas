"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRight, ClipboardList, FileUp, History, PencilLine, Target, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Select, Skeleton, cn } from "@/components/ui";
import { Notice } from "@/components/ui/client";
import { groupHistory, type BatchKind, type HistoryBatch, type HistoryEntry, type HistoryPage } from "@/lib/audit/history";
import type { OfferingDetail } from "@/lib/obe/queries";

const KIND_ICON: Record<BatchKind, typeof History> = {
  grades: PencilLine,
  import: FileUp,
  assessmentCreate: ClipboardList,
  assessmentUpdate: ClipboardList,
  assessmentDelete: Trash2,
  threshold: Target,
};

type Filters = { student: string; assessment: string; kind: string };

/** A number per server snapshot of the class, so the history refetches after a save or import. */
const revisions = new WeakMap<object, number>();
let lastRevision = 0;
function revisionOf(detail: OfferingDetail): number {
  if (!revisions.has(detail)) revisions.set(detail, ++lastRevision);
  return revisions.get(detail)!;
}

/**
 * Read-only change history for the class: one row per save or import, expandable to the
 * individual old → new values. Visible to everyone who can open the class.
 */
export function HistoryTab({ detail }: { detail: OfferingDetail }) {
  const t = useTranslations("history");
  const [filters, setFilters] = useState<Filters>({ student: "", assessment: "", kind: "" });
  const requestKey = JSON.stringify({ ...filters, revision: revisionOf(detail) });
  const [data, setData] = useState<{ key: string; entries: HistoryEntry[]; cursor: string | null; error?: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loading = data?.key !== requestKey;

  function url(cursor?: string | null) {
    const p = new URLSearchParams({ limit: "50" });
    if (filters.student) p.set("student", filters.student);
    if (filters.assessment) p.set("assessment", filters.assessment);
    if (filters.kind) p.set("kind", filters.kind);
    if (cursor) p.set("cursor", cursor);
    return `/api/offerings/${detail.id}/history?${p}`;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url());
        const page: HistoryPage = await res.json();
        if (!res.ok) throw new Error();
        if (!cancelled) setData({ key: requestKey, entries: page.entries, cursor: page.nextCursor });
      } catch {
        if (!cancelled) setData({ key: requestKey, entries: [], cursor: null, error: t("loadFailed") });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `url` reads the same filters that make up requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, detail.id]);

  async function loadMore() {
    if (!data?.cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(url(data.cursor));
      const page: HistoryPage = await res.json();
      if (res.ok) setData((d) => (d ? { ...d, entries: [...d.entries, ...page.entries], cursor: page.nextCursor } : d));
    } finally {
      setLoadingMore(false);
    }
  }

  const batches = useMemo(() => groupHistory(data?.entries ?? []), [data]);
  const filtered = filters.student || filters.assessment || filters.kind;
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <Select value={filters.kind} onChange={(e) => set({ kind: e.target.value })} aria-label={t("filterKind")}>
          <option value="">{t("kinds.all")}</option>
          <option value="grades">{t("kinds.grades")}</option>
          <option value="assessments">{t("kinds.assessments")}</option>
          <option value="target">{t("kinds.target")}</option>
          <option value="imports">{t("kinds.imports")}</option>
        </Select>
        <Select value={filters.student} onChange={(e) => set({ student: e.target.value })} aria-label={t("filterStudent")} className="max-w-56">
          <option value="">{t("allStudents")}</option>
          {detail.students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={filters.assessment} onChange={(e) => set({ assessment: e.target.value })} aria-label={t("filterAssessment")} className="max-w-56">
          <option value="">{t("allAssessments")}</option>
          {detail.assessments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ student: "", assessment: "", kind: "" })}>
            {t("clearFilters")}
          </Button>
        )}
      </div>

      <div aria-busy={loading} aria-live="polite">
        {loading ? (
          <div className="ui-delayed space-y-4 p-5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-72 max-w-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.error ? (
          <div className="p-5">
            <Notice tone="error">{data.error}</Notice>
          </div>
        ) : batches.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<History />} title={filtered ? t("emptyFilteredTitle") : t("emptyTitle")} description={filtered ? t("emptyFilteredBody") : t("emptyBody")} />
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {batches.map((b) => (
              <BatchRow key={b.batch} batch={b} detail={detail} />
            ))}
          </ol>
        )}
      </div>

      {data?.cursor && !loading && (
        <div className="border-t border-border px-5 py-3">
          <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
            {t("loadMore")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function BatchRow({ batch: b, detail }: { batch: HistoryBatch; detail: OfferingDetail }) {
  const t = useTranslations("history");
  const format = useFormatter();
  const Icon = KIND_ICON[b.kind];
  const first = b.entries[0];
  const when = new Date(b.createdAt);
  const title = first.assessment?.title ?? "";
  const summary = (() => {
    switch (b.kind) {
      case "grades":
        return t("summary.grades", { actor: b.actorName, count: b.set + b.cleared });
      case "import":
        return t("summary.import", { actor: b.actorName, count: b.set + b.cleared });
      case "assessmentCreate":
        return t("summary.assessmentCreate", { actor: b.actorName, title });
      case "assessmentUpdate":
        return t("summary.assessmentUpdate", { actor: b.actorName, title });
      case "assessmentDelete":
        return t("summary.assessmentDelete", { actor: b.actorName, title });
      case "threshold":
        return t("summary.threshold", { actor: b.actorName, before: String(first.before), after: String(first.after) });
    }
  })();
  const details = b.entries.filter((e) => e.action !== "canvas.import" && e.action !== "threshold.update" && e.action !== "assessment.create");

  return (
    <li>
      <details className="group/b">
        <summary
          className={cn(
            "flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden",
            !details.length && "cursor-default",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{summary}</span>
            <span className="flex items-center gap-2 text-xs text-muted">
              <time dateTime={b.createdAt} title={format.dateTime(when, { dateStyle: "full", timeStyle: "long" })}>
                {format.dateTime(when, { dateStyle: "medium", timeStyle: "short" })}
              </time>
              {b.source === "canvas" && <Badge tone="brand">Canvas</Badge>}
            </span>
          </span>
          {details.length > 0 && (
            <ChevronRight
              aria-hidden
              className="size-4 text-muted transition-transform duration-(--dur-2) group-open/b:rotate-90 motion-reduce:transition-none"
            />
          )}
        </summary>
        {details.length > 0 && (
          <ul className="space-y-1 pb-3 pl-16 pr-5 text-sm">
            {details.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                <ChangeLine entry={e} detail={detail} />
              </li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

function show(v: unknown): string {
  return v === null || v === undefined ? "—" : String(v);
}

function ChangeLine({ entry: e, detail }: { entry: HistoryEntry; detail: OfferingDetail }) {
  const t = useTranslations("history");
  const ploCode = new Map(detail.plos.map((p) => [p.id, p.code]));
  const weights = (v: unknown) =>
    Array.isArray(v) ? (v as { plo: string; weight: number }[]).map((w) => `${ploCode.get(w.plo) ?? "PLO"} ${w.weight}%`).join(", ") || "—" : show(v);

  if (e.action === "grade.set" || e.action === "grade.clear") {
    return (
      <>
        <span className="text-muted">
          {e.student?.name} · {e.assessment?.title}
        </span>
        <span className="tabular">
          {show(e.before)} <span aria-hidden>→</span>
          <span className="sr-only">{t("to")}</span> {e.action === "grade.clear" ? <span className="text-muted">{t("cleared")}</span> : show(e.after)}
        </span>
      </>
    );
  }
  if (e.action === "assessment.update") {
    const before = (e.before ?? {}) as Record<string, unknown>;
    const after = (e.after ?? {}) as Record<string, unknown>;
    return (
      <span className="flex flex-col gap-0.5">
        {Object.keys(after).map((field) => (
          <span key={field}>
            <span className="text-muted">{t.has(`fields.${field}`) ? t(`fields.${field}`) : field}:</span>{" "}
            <span className="tabular">
              {field === "ploWeights" ? weights(before[field]) : show(before[field])} <span aria-hidden>→</span>
              <span className="sr-only">{t("to")}</span> {field === "ploWeights" ? weights(after[field]) : show(after[field])}
            </span>
          </span>
        ))}
      </span>
    );
  }
  if (e.action === "assessment.delete") {
    const before = (e.before ?? {}) as { maxPoints?: number; gradeWeight?: number; grades?: number };
    return <span className="text-muted">{t("deletedDetail", { grades: before.grades ?? 0, max: show(before.maxPoints), weight: show(before.gradeWeight) })}</span>;
  }
  return null;
}
