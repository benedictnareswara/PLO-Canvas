import type { AuditAction } from "@/models";

/** One audit entry before it is stamped with actor, batch and time (see recordAudit). */
export interface AuditInput {
  action: AuditAction;
  student?: string;
  assessment?: string;
  assessmentTitle?: string;
  before?: unknown;
  after?: unknown;
}

export interface GradeWrite {
  student: string;
  assessment: string;
  score: number | null;
}

/**
 * Turns a set of grade writes into audit entries against the stored values: `grade.set` (new or
 * changed score) and `grade.clear` (score removed). Writes that change nothing produce no entry,
 * and the caller should skip them too, so the history only shows real changes.
 */
export function diffGrades(
  current: Map<string, number>,
  writes: GradeWrite[],
  titleOf: (assessmentId: string) => string | undefined = () => undefined,
): AuditInput[] {
  const out: AuditInput[] = [];
  for (const w of writes) {
    const before = current.get(`${w.student}:${w.assessment}`) ?? null;
    if (before === w.score) continue;
    out.push({
      action: w.score === null ? "grade.clear" : "grade.set",
      student: w.student,
      assessment: w.assessment,
      assessmentTitle: titleOf(w.assessment),
      before,
      after: w.score,
    });
  }
  return out;
}

/** The fields of an assessment that history shows, for create/update/delete entries. */
export interface AssessmentSnapshot {
  title: string;
  maxPoints: number;
  gradeWeight: number;
  ploWeights: { plo: string; weight: number }[];
}

/** Only the fields that changed, as { before, after }; null when nothing changed. */
export function diffFields<T extends object>(before: T, after: T): { before: Partial<T>; after: Partial<T> } | null {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
