"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { formatScoreInput } from "@/lib/gradebook/parse-score";
import { buildSavePayload, dirtyKeys, invalidCells, previewCourseGrade, rebase, valuesFromGrades } from "@/lib/gradebook/state";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import type { OfferingDetail } from "@/lib/obe/queries";

const UNDO_LIMIT = 50;

interface CellsState {
  values: Record<string, string>;
  /** Each entry holds the previous text of the cells one edit (or one paste) changed. */
  undo: Record<string, string>[];
}

type CellsAction =
  | { type: "set"; key: string; text: string; undoable: boolean }
  | { type: "setMany"; next: Record<string, string>; changed: string[] }
  | { type: "patch"; patch: Record<string, string> }
  | { type: "replace"; values: Record<string, string> }
  | { type: "undo" }
  | { type: "clearUndo" }
  | { type: "reset"; values: Record<string, string> };

/** Pure, so React may call it twice in development without doubling undo entries. */
function cellsReducer(state: CellsState, action: CellsAction): CellsState {
  const remember = (entry: Record<string, string>) => [...state.undo.slice(-(UNDO_LIMIT - 1)), entry];
  switch (action.type) {
    case "set":
      if (state.values[action.key] === action.text) return state;
      return {
        values: { ...state.values, [action.key]: action.text },
        undo: action.undoable ? remember({ [action.key]: state.values[action.key] ?? "" }) : state.undo,
      };
    case "setMany":
      if (!action.changed.length) return state;
      return { values: action.next, undo: remember(Object.fromEntries(action.changed.map((k) => [k, state.values[k] ?? ""]))) };
    case "patch":
      return { ...state, values: { ...state.values, ...action.patch } };
    case "replace":
      return { ...state, values: action.values };
    case "undo": {
      const last = state.undo[state.undo.length - 1];
      return last ? { values: { ...state.values, ...last }, undo: state.undo.slice(0, -1) } : state;
    }
    case "clearUndo":
      return state.undo.length ? { ...state, undo: [] } : state;
    case "reset":
      return { values: action.values, undo: [] };
  }
}

/**
 * One store for the desktop grid and the phone grader: cell text, the server baseline, undo,
 * validation, conflicts, save, the leave guard and ⌘/Ctrl+S.
 */
export function useGradebookState(detail: OfferingDetail, canEdit: boolean) {
  const t = useTranslations("gradebook");
  const router = useRouter();
  const { students, assessments, grades } = detail;

  const server = useMemo(() => valuesFromGrades(students.map((s) => s.id), assessments, grades), [students, assessments, grades]);
  const [{ values, undo: undoStack }, dispatch] = useReducer(cellsReducer, { values: server, undo: [] });
  const [baseline, setBaseline] = useState(server);
  const [seenServer, setSeenServer] = useState(server);
  // Fresh server data (after a save or router.refresh) re-bases the grid without losing edits.
  if (server !== seenServer) {
    setSeenServer(server);
    const next = rebase(values, baseline, server);
    if (next) {
      dispatch({ type: "replace", values: next.values });
      setBaseline(next.baseline);
    }
  }

  const [conflicts, setConflicts] = useState<Map<string, number | null>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxById = useMemo(() => new Map(assessments.map((a) => [a.id, a.maxPoints])), [assessments]);
  const dirty = useMemo(() => dirtyKeys(values, baseline), [values, baseline]);
  const dirtySet = useMemo(() => new Set(dirty), [dirty]);
  const invalid = useMemo(() => invalidCells(dirty, values, maxById), [dirty, values, maxById]);

  /** `undoable: false` for keystroke-level edits (phone inputs), so undo doesn't step per character. */
  const setCell = useCallback((key: string, text: string, { undoable = true }: { undoable?: boolean } = {}) => {
    dispatch({ type: "set", key, text, undoable });
  }, []);

  /** Apply many cells at once (a paste) as a single undo step. */
  const setCells = useCallback((next: Record<string, string>, changed: string[]) => {
    dispatch({ type: "setMany", next, changed });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);

  const discard = useCallback(() => {
    dispatch({ type: "reset", values: baseline });
    setConflicts(new Map());
    setError(null);
  }, [baseline]);

  /** Conflict resolution: "theirs" takes the stored value; "mine" keeps the edit and re-bases on theirs. */
  const resolveConflict = useCallback(
    (key: string, choice: "theirs" | "mine") => {
      const theirs = formatScoreInput(conflicts.get(key));
      setBaseline((b) => ({ ...b, [key]: theirs }));
      if (choice === "theirs") dispatch({ type: "patch", patch: { [key]: theirs } });
      setConflicts((c) => {
        const n = new Map(c);
        n.delete(key);
        if (!n.size) setError(null);
        return n;
      });
    },
    [conflicts],
  );

  const save = useCallback(async () => {
    if (!canEdit || !dirty.length || invalid.size || conflicts.size || saving) return false;
    setSaving(true);
    setError(null);
    const sent = Object.fromEntries(dirty.map((k) => [k, values[k]]));
    try {
      const res = await fetch(`/api/offerings/${detail.id}/grades`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades: buildSavePayload(dirty, values, baseline) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(data.conflicts)) {
        setConflicts(new Map(data.conflicts.map((c: { student: string; assessment: string; current: number | null }) => [`${c.student}:${c.assessment}`, c.current])));
        setError(t("conflictTitle", { count: data.conflicts.length }));
        return false;
      }
      if (!res.ok) throw new Error(data.error ?? t("saveFailed"));
      setBaseline((b) => ({ ...b, ...sent }));
      dispatch({ type: "clearUndo" });
      toast.success(t("saved", { count: dirty.length }), { description: t("recalculated") });
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof TypeError ? t("network") : (e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [canEdit, dirty, invalid, conflicts, saving, values, baseline, detail.id, router, t]);

  useUnsavedChangesGuard(canEdit && dirty.length > 0, dirty.length);
  useHotkeys("mod+s", () => void save(), { enabled: canEdit, allowInInputs: true });

  const preview = useCallback((studentId: string, overrides?: Record<string, string>) => previewCourseGrade(studentId, assessments, overrides ? { ...values, ...overrides } : values), [assessments, values]);

  return {
    values,
    baseline,
    dirty,
    dirtySet,
    invalid,
    conflicts,
    saving,
    error,
    canUndo: undoStack.length > 0,
    setCell,
    setCells,
    undo,
    discard,
    resolveConflict,
    save,
    preview,
  };
}

export type GradebookState = ReturnType<typeof useGradebookState>;
