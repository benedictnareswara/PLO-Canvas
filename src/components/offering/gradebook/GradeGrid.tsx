"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowLeftRight } from "lucide-react";
import { cn } from "@/components/ui";
import { applyPaste, cellKey, parseClipboardMatrix } from "@/lib/gradebook/paste";
import { formatPct } from "@/components/AtRiskBadge";
import type { OfferingAssessmentView } from "@/lib/obe/queries";
import type { PloInfo, StudentSummary } from "@/lib/obe/types";
import { MAX_SCORE_FACTOR, type ScoreError } from "@/lib/gradebook/parse-score";
import type { GradebookState } from "./useGradebookState";
import { CellHistory } from "./CellHistory";

interface Editing {
  key: string;
  text: string;
  /** "replace": started by typing (arrows commit and move); "edit": Enter/F2/double-click (arrows move the caret). */
  mode: "replace" | "edit";
}

const STARTS_EDIT = /^[0-9.,]$/;
const PAGE = 10;

/**
 * Spreadsheet-style gradebook (WAI-ARIA grid pattern). One tab stop with a roving cell cursor;
 * arrows, Tab, Home/End and Page keys move; typing a digit or Enter/F2 edits; Enter/Tab commit and
 * move; Esc reverts; Delete clears; ⌘/Ctrl+Z undoes; ⌘/Ctrl+V pastes a block from a spreadsheet.
 * Moving between cells is deliberately not animated.
 */
export function GradeGrid({
  offeringId,
  students,
  assessments,
  plos,
  state,
  canEdit,
}: {
  offeringId: string;
  students: StudentSummary[];
  assessments: OfferingAssessmentView[];
  plos: PloInfo[];
  state: GradebookState;
  canEdit: boolean;
}) {
  const t = useTranslations("gradebook");
  const gridId = useId();
  const tableRef = useRef<HTMLTableElement>(null);
  const [active, setActive] = useState({ row: 0, col: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [historyFor, setHistoryFor] = useState<{ row: number; col: number } | null>(null);
  const closeHistory = useCallback(() => setHistoryFor(null), []);

  const rows = students.length;
  const cols = assessments.length;
  const row = Math.min(active.row, Math.max(0, rows - 1));
  const col = Math.min(active.col, Math.max(0, cols - 1));
  const activeKey = students[row] && assessments[col] ? cellKey(students[row].id, assessments[col].id) : null;
  const ploCode = useMemo(() => new Map(plos.map((p) => [p.id, p.code])), [plos]);

  const cellDomId = (r: number, c: number) => `${gridId}-${r}-${c}`;

  // Keep DOM focus on the cursor cell (or its editor) while the grid has focus.
  useEffect(() => {
    if (!focusWithin) return;
    if (editing) return; // the editor focuses itself
    const el = document.getElementById(cellDomId(row, col));
    if (el && document.activeElement !== el) el.focus({ preventScroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, col, editing, focusWithin]);

  function move(r: number, c: number) {
    setActive({ row: Math.max(0, Math.min(rows - 1, r)), col: Math.max(0, Math.min(cols - 1, c)) });
  }

  function commit(next?: { row: number; col: number }) {
    if (editing) {
      state.setCell(editing.key, editing.text.trim());
      setEditing(null);
    }
    if (next) move(next.row, next.col);
  }

  function startEdit(mode: Editing["mode"], text?: string) {
    if (!canEdit || !activeKey) return;
    setEditing({ key: activeKey, text: text ?? state.values[activeKey] ?? "", mode });
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    if (editing || !rows || !cols) return;
    const mod = e.metaKey || e.ctrlKey;
    const handled = () => e.preventDefault();
    switch (e.key) {
      case "ArrowUp":
        handled();
        return move(row - 1, col);
      case "ArrowDown":
        handled();
        return move(row + 1, col);
      case "ArrowLeft":
        handled();
        return move(row, col - 1);
      case "ArrowRight":
        handled();
        return move(row, col + 1);
      case "PageUp":
        handled();
        return move(row - PAGE, col);
      case "PageDown":
        handled();
        return move(row + PAGE, col);
      case "Home":
        handled();
        return mod ? move(0, 0) : move(row, 0);
      case "End":
        handled();
        return mod ? move(rows - 1, cols - 1) : move(row, cols - 1);
      case "Tab":
        // Tab moves along the row; at the row's edge it leaves the grid as usual.
        if (e.shiftKey ? col > 0 : col < cols - 1) {
          handled();
          move(row, col + (e.shiftKey ? -1 : 1));
        }
        return;
      case "Enter":
      case "F2":
        handled();
        return startEdit("edit");
      case "Delete":
      case "Backspace":
        if (canEdit && activeKey) {
          handled();
          state.setCell(activeKey, "");
        }
        return;
    }
    if (e.altKey && !mod && e.code === "KeyH") {
      handled();
      setHistoryFor({ row, col });
      return;
    }
    if (mod && e.key.toLowerCase() === "z" && canEdit) {
      handled();
      state.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "c" && activeKey) {
      handled();
      void navigator.clipboard?.writeText(state.values[activeKey] ?? "");
      return;
    }
    if (!mod && !e.altKey && STARTS_EDIT.test(e.key)) {
      handled();
      startEdit("replace", e.key);
    }
  }

  function onEditorKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!editing) return;
    const arrowsMove = editing.mode === "replace";
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        return commit({ row: row + (e.shiftKey ? -1 : 1), col });
      case "Tab":
        if (e.shiftKey ? col > 0 : col < cols - 1) {
          e.preventDefault();
          return commit({ row, col: col + (e.shiftKey ? -1 : 1) });
        }
        return commit();
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        return setEditing(null);
      case "ArrowUp":
        e.preventDefault();
        return commit({ row: row - 1, col });
      case "ArrowDown":
        e.preventDefault();
        return commit({ row: row + 1, col });
      case "ArrowLeft":
      case "ArrowRight":
        if (arrowsMove) {
          e.preventDefault();
          return commit({ row, col: col + (e.key === "ArrowLeft" ? -1 : 1) });
        }
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    if (!canEdit) return;
    const text = e.clipboardData.getData("text/plain");
    // A single value typed into the editor pastes natively; blocks fill the grid.
    if (editing && !/[\t\n]/.test(text)) return;
    e.preventDefault();
    if (editing) setEditing(null);
    const matrix = parseClipboardMatrix(text);
    const { next, changed } = applyPaste(
      state.values,
      { row, col },
      matrix,
      students.map((s) => s.id),
      assessments.map((a) => a.id),
    );
    state.setCells(next, changed);
    setAnnouncement(t("pasted", { count: changed.length }));
  }

  if (!rows) return null;

  return (
    <div
      className="ui-scroll-x max-h-[min(70dvh,52rem)] overflow-y-auto"
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false);
      }}
    >
      <table
        ref={tableRef}
        role="grid"
        aria-label={t("gridLabel")}
        aria-rowcount={rows + 1}
        aria-colcount={cols + 2}
        aria-describedby={`${gridId}-help`}
        onKeyDown={onGridKeyDown}
        onPaste={onPaste}
        // Pointer handling is delegated here so the memoised cells get no per-render callbacks.
        onPointerDown={(e) => {
          const cell = (e.target as Element).closest<HTMLElement>("[data-row]");
          if (!cell || cell.querySelector("input")) return;
          const r = Number(cell.dataset.row);
          const c = Number(cell.dataset.col);
          if (editing) commit();
          setActive({ row: r, col: c });
        }}
        onDoubleClick={(e) => {
          if ((e.target as Element).closest("[data-row]")) startEdit("edit");
        }}
        onContextMenu={(e) => {
          const cell = (e.target as Element).closest<HTMLElement>("[data-row]");
          if (!cell || cell.querySelector("input")) return;
          e.preventDefault();
          const at = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
          setActive(at);
          setHistoryFor(at);
        }}
        className="w-full border-separate border-spacing-0 text-sm"
      >
        <thead>
          <tr aria-rowindex={1}>
            <th
              scope="col"
              className="sticky top-0 left-0 z-30 min-w-52 border-b border-border bg-surface-2 px-3 py-2 pl-5 text-left text-xs font-medium text-muted"
            >
              {t("student")}
            </th>
            {assessments.map((a) => (
              <th key={a.id} scope="col" className="sticky top-0 z-20 min-w-32 border-b border-l border-border bg-surface-2 px-3 py-2 text-right align-bottom">
                <div className="line-clamp-2 text-xs font-semibold text-foreground" title={a.title}>
                  {a.title}
                </div>
                <div className="mt-0.5 text-[0.6875rem] font-normal text-muted tabular">
                  / {a.maxPoints} · {a.gradeWeight}%
                </div>
                {a.ploWeights.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-end gap-0.5">
                    {[...a.ploWeights]
                      .sort((x, y) => x.number - y.number)
                      .map((w) => (
                        <span key={w.plo} className="rounded bg-info-soft px-1 text-[0.625rem] font-medium text-info">
                          {ploCode.get(w.plo) ?? `PLO ${w.number}`}
                        </span>
                      ))}
                  </div>
                )}
              </th>
            ))}
            <th scope="col" className="sticky top-0 right-0 z-20 min-w-32 border-b border-l border-border bg-surface-2 px-3 py-2 pr-5 text-right text-xs font-medium text-muted">
              {t("courseGrade")}
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, r) => {
            const rowDirty = assessments.some((a) => state.dirtySet.has(cellKey(s.id, a.id)));
            const editingThisRow = editing && editing.key.startsWith(`${s.id}:`);
            const grade = state.preview(s.id, editingThisRow ? { [editing.key]: editing.text } : undefined);
            return (
              <tr key={s.id} aria-rowindex={r + 2} className="group/row">
                <th scope="row" className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 pl-5 text-left font-normal group-hover/row:bg-surface-2">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="text-xs text-muted tabular">{s.studentId}</div>
                </th>
                {assessments.map((a, c) => {
                  const key = cellKey(s.id, a.id);
                  const isActive = r === row && c === col;
                  const isEditing = isActive && editing?.key === key;
                  return (
                    <GridCell
                      key={a.id}
                      id={cellDomId(r, c)}
                      row={r}
                      col={c}
                      text={state.values[key] ?? ""}
                      active={isActive}
                      focused={isActive && focusWithin}
                      dirty={state.dirtySet.has(key)}
                      error={state.invalid.get(key)}
                      conflict={state.conflicts.has(key)}
                      editor={
                        isEditing
                          ? {
                              text: editing.text,
                              onChange: (text) => setEditing((ed) => (ed ? { ...ed, text } : ed)),
                              onKeyDown: onEditorKeyDown,
                              onBlur: () => commit(),
                            }
                          : null
                      }
                      max={a.maxPoints}
                    />
                  );
                })}
                <td className="sticky right-0 border-b border-l border-border bg-surface px-3 py-1.5 pr-5 text-right whitespace-nowrap group-hover/row:bg-surface-2">
                  <span className={cn("tabular", rowDirty && "text-muted italic")} title={rowDirty ? t("previewHint") : undefined}>
                    {formatPct(grade.pct)}
                  </span>
                  <span className={cn("ml-2 inline-block min-w-7 rounded px-1.5 py-0.5 text-center text-xs font-medium", rowDirty ? "bg-surface-2 text-muted italic" : "bg-brand-soft text-brand")}>
                    {grade.letter}
                  </span>
                  {rowDirty && <span className="sr-only">{t("previewHint")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p id={`${gridId}-help`} className="sr-only">
        {canEdit ? t("gridHelp") : t("gridHelpReadOnly")}
      </p>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {historyFor && students[historyFor.row] && assessments[historyFor.col] && (
        <CellHistory
          offeringId={offeringId}
          studentId={students[historyFor.row].id}
          assessmentId={assessments[historyFor.col].id}
          label={`${students[historyFor.row].name} · ${assessments[historyFor.col].title}`}
          anchorId={cellDomId(historyFor.row, historyFor.col)}
          onClose={closeHistory}
        />
      )}
    </div>
  );
}

interface CellEditor {
  text: string;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}

/** Only the cell being edited receives callbacks, so memo skips every other cell on each keystroke. */
const GridCell = memo(function GridCell({
  id,
  row,
  col,
  text,
  active,
  focused,
  dirty,
  error,
  conflict,
  editor,
  max,
}: {
  id: string;
  row: number;
  col: number;
  text: string;
  active: boolean;
  focused: boolean;
  dirty: boolean;
  error: ScoreError | undefined;
  conflict: boolean;
  editor: CellEditor | null;
  max: number;
}) {
  const t = useTranslations("gradebook");
  const errorText = error ? t(`errors.${error}`, { max: max * MAX_SCORE_FACTOR }) : null;
  return (
    <td
      id={id}
      role="gridcell"
      data-row={row}
      data-col={col}
      tabIndex={active && !editor ? 0 : -1}
      aria-invalid={error ? true : undefined}
      title={errorText ?? undefined}
      className={cn(
        "relative h-10 border-b border-l border-border px-3 text-right tabular outline-none group-hover/row:bg-surface-2/60",
        error && "bg-risk-soft text-risk",
        conflict && !error && "bg-info-soft",
        active && "outline-2 -outline-offset-2",
        active && (focused ? "outline-brand" : "outline-border-strong"),
      )}
    >
      {dirty && (
        <>
          <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-warn" />
          <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-warn" />
        </>
      )}
      {editor ? (
        <input
          // Editors mount only while editing, so focusing on mount is the intended behaviour.
          autoFocus
          value={editor.text}
          onChange={(e) => editor.onChange(e.target.value)}
          onKeyDown={editor.onKeyDown}
          onBlur={editor.onBlur}
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("editCell")}
          className="absolute inset-0.5 w-[calc(100%-0.25rem)] rounded-[0.25rem] bg-surface px-2.5 text-right text-sm tabular text-foreground outline-none"
        />
      ) : (
        <span className="inline-flex items-center gap-1">
          {error && <AlertCircle className="size-3.5 shrink-0" aria-hidden />}
          {conflict && !error && <ArrowLeftRight className="size-3.5 shrink-0 text-info" aria-hidden />}
          {text === "" ? <span className="text-subtle">—</span> : text}
        </span>
      )}
      {dirty && <span className="sr-only">{t("unsaved")}</span>}
      {errorText && <span className="sr-only">{errorText}</span>}
      {conflict && <span className="sr-only">{t("conflictCell")}</span>}
    </td>
  );
});
