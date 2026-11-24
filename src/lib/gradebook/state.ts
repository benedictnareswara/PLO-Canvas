import { courseGrade, letterGrade } from "@/lib/obe/engine";
import { cellKey } from "./paste";
import { formatScoreInput, parseScore, validateScore, type ScoreError } from "./parse-score";

/** An open cell editor in the gradebook grid. */
export interface CellEdit {
  key: string;
  text: string;
  /** "replace": started by typing (arrows commit and move); "edit": Enter/F2/double-click (arrows move the caret). */
  mode: "replace" | "edit";
}

/**
 * A character typed on a cell. With no editor open it starts one holding that character. Keys can
 * arrive faster than the editor renders (fast typing, a slow machine): a key for the cell whose
 * editor is already pending is appended, so typing "85" never becomes "5".
 */
export function typeIntoCell(editing: CellEdit | null, key: string, char: string): CellEdit {
  if (editing && editing.key === key) return { ...editing, text: editing.text + char };
  return { key, text: char, mode: "replace" };
}

export interface GradebookAssessment {
  id: string;
  maxPoints: number;
  gradeWeight: number;
}

/** Cell text for every (student, assessment) pair, from the stored grade matrix. */
export function valuesFromGrades(
  studentIds: string[],
  assessments: GradebookAssessment[],
  grades: Record<string, Record<string, number>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of studentIds) for (const a of assessments) out[cellKey(s, a.id)] = formatScoreInput(grades[s]?.[a.id]);
  return out;
}

/** Two cell texts mean the same score ("85,5" vs "85.5", " 90" vs "90"). */
export function sameScore(a: string, b: string): boolean {
  if (a === b) return true;
  // NaN never equals itself, so two different unparseable texts stay "different".
  return parseScore(a) === parseScore(b);
}

export function dirtyKeys(values: Record<string, string>, baseline: Record<string, string>): string[] {
  return Object.keys(values).filter((k) => !sameScore(values[k], baseline[k] ?? ""));
}

export function invalidCells(keys: string[], values: Record<string, string>, maxById: Map<string, number>): Map<string, ScoreError> {
  const out = new Map<string, ScoreError>();
  for (const k of keys) {
    const max = maxById.get(k.split(":")[1]);
    if (max === undefined) continue;
    const { error } = validateScore(values[k] ?? "", max);
    if (error) out.set(k, error);
  }
  return out;
}

export interface GradeChange {
  student: string;
  assessment: string;
  score: number | null;
  /** The value this edit was based on; the server rejects the change if it no longer matches. */
  expected: number | null;
}

/** The save request body: only changed cells, each with the baseline value it replaces. */
export function buildSavePayload(keys: string[], values: Record<string, string>, baseline: Record<string, string>): GradeChange[] {
  return keys.map((k) => {
    const [student, assessment] = k.split(":");
    return { student, assessment, score: parseScore(values[k]), expected: parseScore(baseline[k] ?? "") };
  });
}

/**
 * Re-bases the grid on fresh server data without losing the user's edits: cells that are not
 * dirty take the new server value; dirty cells keep their edit. Returns null when nothing changed.
 */
export function rebase(
  values: Record<string, string>,
  baseline: Record<string, string>,
  server: Record<string, string>,
): { values: Record<string, string>; baseline: Record<string, string> } | null {
  let changed = false;
  const nextValues = { ...values };
  for (const [k, v] of Object.entries(server)) {
    if (baseline[k] === v) continue;
    changed = true;
    if (sameScore(values[k] ?? "", baseline[k] ?? "")) nextValues[k] = v;
  }
  for (const k of Object.keys(values)) if (!(k in server)) changed = true;
  if (!changed) return null;
  for (const k of Object.keys(nextValues)) if (!(k in server)) delete nextValues[k];
  return { values: nextValues, baseline: { ...server } };
}

/** Blank cells of one assessment (for the given students), i.e. work not graded yet. */
export function blankCells(values: Record<string, string>, assessmentId: string, studentIds: string[]): string[] {
  return studentIds.map((s) => cellKey(s, assessmentId)).filter((k) => (values[k] ?? "").trim() === "");
}

/**
 * "Count blanks as 0": every blank cell of the assessment becomes "0". Attainment only counts graded
 * work, so until then a student who never handed it in is judged on the rest (proposal §1.3 step 3).
 */
export function fillBlanks(values: Record<string, string>, assessmentId: string, studentIds: string[]): { next: Record<string, string>; changed: string[] } {
  const changed = blankCells(values, assessmentId, studentIds);
  const next = { ...values };
  for (const k of changed) next[k] = "0";
  return { next, changed };
}

/** Live course grade for one student from the cells as typed (invalid cells are ignored). */
export function previewCourseGrade(
  studentId: string,
  assessments: GradebookAssessment[],
  values: Record<string, string>,
): { pct: number | null; letter: string } {
  const scores: Record<string, number | undefined> = {};
  for (const a of assessments) {
    const { value, error } = validateScore(values[cellKey(studentId, a.id)] ?? "", a.maxPoints);
    if (!error && value !== null) scores[a.id] = value;
  }
  const pct = courseGrade(
    assessments.map((a) => ({ id: a.id, maxPoints: a.maxPoints, gradeWeight: a.gradeWeight, ploWeights: [] })),
    scores,
  );
  return { pct, letter: letterGrade(pct) };
}
