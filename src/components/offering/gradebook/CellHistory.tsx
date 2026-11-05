"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Spinner } from "@/components/ui";
import { placeFloating } from "@/components/ui/floating";
import type { HistoryEntry, HistoryPage } from "@/lib/audit/history";

/**
 * Popover with the recent history of one gradebook cell (opened with Alt+H or a right-click).
 * Light dismiss and Esc come from the Popover API; focus goes back to the cell on close.
 */
export function CellHistory({
  offeringId,
  studentId,
  assessmentId,
  label,
  anchorId,
  onClose,
}: {
  offeringId: string;
  studentId: string;
  assessmentId: string;
  label: string;
  anchorId: string;
  onClose: () => void;
}) {
  const t = useTranslations("history");
  const format = useFormatter();
  const ref = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const anchor = document.getElementById(anchorId);
    if (!el || !anchor) return;
    el.showPopover();
    placeFloating(anchor, el, { side: "bottom", align: "end" });
    el.focus();
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "closed") {
        anchor.focus();
        onClose();
      }
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, [anchorId, onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/offerings/${offeringId}/history?student=${studentId}&assessment=${assessmentId}&kind=grades&limit=10`);
        if (!res.ok) throw new Error();
        const page: HistoryPage = await res.json();
        if (!cancelled) setEntries(page.entries);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offeringId, studentId, assessmentId]);

  return (
    <div
      ref={ref}
      popover="auto"
      tabIndex={-1}
      role="dialog"
      aria-label={t("cellTitle", { cell: label })}
      className="ui-pop w-72 rounded-lg border border-border bg-surface p-3 text-sm text-foreground shadow-e3 outline-none"
    >
      <p className="mb-2 text-xs font-medium text-muted">{t("cellTitle", { cell: label })}</p>
      {failed ? (
        <p className="text-risk">{t("loadFailed")}</p>
      ) : entries === null ? (
        <Spinner label={t("loading")} />
      ) : entries.length === 0 ? (
        <p className="text-muted">{t("cellEmpty")}</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="font-medium tabular">
                {e.before === null ? "—" : String(e.before)} <span aria-hidden>→</span>
                <span className="sr-only">{t("to")}</span> {e.after === null ? t("cleared") : String(e.after)}
              </span>
              <span className="block text-xs text-muted">
                {e.actorName} · {format.dateTime(new Date(e.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                {e.source === "canvas" && " · Canvas"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
