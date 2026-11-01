"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Search, Undo2, X } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState, Input, Kbd, ToggleChip, cn } from "@/components/ui";
import { Notice } from "@/components/ui/client";
import { ExportMenu } from "@/components/ExportMenu";
import { cellKey } from "@/lib/gradebook/paste";
import { useHotkeyLabel } from "@/lib/hooks/useHotkeys";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useUrlState } from "@/lib/hooks/useUrlState";
import type { OfferingDetail } from "@/lib/obe/queries";
import { GradeGrid } from "../gradebook/GradeGrid";
import { MobileGrader } from "../gradebook/MobileGrader";
import { useGradebookState } from "../gradebook/useGradebookState";
import { exportGradesCsv, exportWorkbook } from "../export";
import { useExportLabels } from "../useExportLabels";

export function GradebookTab({ detail, canEdit }: { detail: OfferingDetail; canEdit: boolean }) {
  const t = useTranslations("gradebook");
  const state = useGradebookState(detail, canEdit);
  const phone = useMediaQuery("(width < 48rem)");
  const exportLabels = useExportLabels();
  const saveKey = useHotkeyLabel("mod+s");
  const pasteKey = useHotkeyLabel("mod+v");
  const undoKey = useHotkeyLabel("mod+z");
  const historyKey = useHotkeyLabel("alt+h");
  const [query, setQuery] = useUrlState("gq", "");
  const [missingOnly, setMissingOnly] = useUrlState("missing", false, { parse: (r) => r === "1", serialize: (v) => (v ? "1" : "") });

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return detail.students.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q) || (s.studentId ?? "").toLowerCase().includes(q)) &&
        (!missingOnly || detail.assessments.some((a) => (state.values[cellKey(s.id, a.id)] ?? "") === "")),
    );
  }, [detail.students, detail.assessments, query, missingOnly, state.values]);

  if (!detail.assessments.length) {
    return (
      <EmptyState
        icon={<ClipboardList />}
        title={t("noAssessmentsTitle")}
        description={t("noAssessmentsBody")}
        action={canEdit && <ButtonLink href="?tab=assessments">{t("goToAssessments")}</ButtonLink>}
      />
    );
  }
  if (!detail.students.length) return <EmptyState title={t("noStudentsTitle")} description={t("noStudentsBody")} />;

  const dirtyCount = state.dirty.length;
  const invalidCount = state.invalid.size;
  const studentName = new Map(detail.students.map((s) => [s.id, s.name]));
  const assessmentTitle = new Map(detail.assessments.map((a) => [a.id, a.title]));

  const filtersActive = query !== "" || missingOnly;
  const empty = students.length === 0 && (
    <div className="p-5">
      <EmptyState
        title={t("noMatchTitle")}
        description={t("noMatchBody")}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setQuery("");
              setMissingOnly(false);
            }}
          >
            {t("clearFilters")}
          </Button>
        }
      />
    </div>
  );

  const saveBar = canEdit && (
    <div
      className={cn(
        "z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-surface px-5 py-3",
        phone ? "fixed inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-e3" : "sticky bottom-0 rounded-b-xl",
      )}
    >
      <p className="min-w-0 flex-1 text-sm" role="status" aria-live="polite">
        {dirtyCount ? (
          <>
            <span className="font-medium">{t("unsavedCount", { count: dirtyCount })}</span>
            {invalidCount > 0 && <span className="text-risk"> · {t("invalidCount", { count: invalidCount })}</span>}
          </>
        ) : (
          <span className="text-muted">{t("allSaved")}</span>
        )}
      </p>
      {!phone && state.canUndo && (
        <Button variant="ghost" size="sm" onClick={state.undo}>
          <Undo2 aria-hidden /> {t("undo")}
        </Button>
      )}
      <Button variant="secondary" onClick={state.discard} disabled={!dirtyCount || state.saving}>
        {t("discard")}
      </Button>
      <Button onClick={() => void state.save()} loading={state.saving} disabled={!dirtyCount || invalidCount > 0 || state.conflicts.size > 0}>
        {t("save")}
        {!phone && <Kbd className="border-transparent bg-brand-fg/15 text-current">{saveKey}</Kbd>}
      </Button>
    </div>
  );

  const conflictPanel = state.conflicts.size > 0 && (
    <Notice tone="warn" className="items-start">
      <p className="font-medium">{state.error}</p>
      <p className="mt-0.5 text-foreground/80">{t("conflictBody")}</p>
      <ul className="mt-2 space-y-1.5">
        {[...state.conflicts].map(([key, theirs]) => {
          const [sid, aid] = key.split(":");
          return (
            <li key={key} className="flex flex-wrap items-center gap-2 text-foreground">
              <span className="min-w-0 flex-1">
                {studentName.get(sid)} · {assessmentTitle.get(aid)}:{" "}
                <span className="tabular">
                  {t("conflictValues", { theirs: theirs ?? "—", mine: state.values[key] || "—" })}
                </span>
              </span>
              <Button size="sm" variant="secondary" onClick={() => state.resolveConflict(key, "theirs")}>
                {t("useTheirs")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => state.resolveConflict(key, "mine")}>
                {t("keepMine")}
              </Button>
            </li>
          );
        })}
      </ul>
    </Notice>
  );

  return (
    <div className={cn(phone && canEdit && "pb-24")}>
      <div className="mb-4 space-y-3">
        {conflictPanel}
        {state.error && state.conflicts.size === 0 && <Notice tone="error">{state.error}</Notice>}
      </div>

      {phone ? (
        <>
          <MobileGrader students={detail.students} assessments={detail.assessments} state={state} canEdit={canEdit} />
          {saveBar}
        </>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
            <div className="relative w-full max-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchLabel")}
                className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("clearSearch")}
                  className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted hover:bg-surface-2"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <ToggleChip checked={missingOnly} onChange={setMissingOnly}>
              {t("missingOnly")}
            </ToggleChip>
            {filtersActive && (
              <span className="text-xs text-muted tabular">{t("showing", { shown: students.length, total: detail.students.length })}</span>
            )}
            <div className="ml-auto">
              <ExportMenu
                size="sm"
                items={[
                  { key: "csv", label: t("exportCsv"), format: "csv", run: () => exportGradesCsv(detail, exportLabels) },
                  { key: "xlsx", label: t("exportXlsx"), format: "xlsx", run: () => exportWorkbook(detail, exportLabels) },
                ]}
              />
            </div>
          </div>
          {empty || <GradeGrid offeringId={detail.id} students={students} assessments={detail.assessments} plos={detail.plos} state={state} canEdit={canEdit} />}
          <p className="border-t border-border px-5 py-2 text-xs text-muted">
            {canEdit && (
              <>
                {t.rich("keyboardHint", {
                  kbd: (chunks) => <Kbd>{chunks}</Kbd>,
                  save: saveKey,
                  paste: pasteKey,
                  undo: undoKey,
                })}{" "}
                ·{" "}
              </>
            )}
            {t.rich("historyHint", { kbd: (chunks) => <Kbd>{chunks}</Kbd>, history: historyKey })}
          </p>
          {saveBar}
        </Card>
      )}
    </div>
  );
}
