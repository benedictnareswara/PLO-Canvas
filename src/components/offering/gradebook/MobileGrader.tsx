"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ClipboardList, User } from "lucide-react";
import { Button, NumberInput, Select, cn } from "@/components/ui";
import { SegmentedControl } from "@/components/ui/client";
import { cellKey } from "@/lib/gradebook/paste";
import { MAX_SCORE_FACTOR } from "@/lib/gradebook/parse-score";
import type { OfferingAssessmentView } from "@/lib/obe/queries";
import type { StudentSummary } from "@/lib/obe/types";
import type { GradebookState } from "./useGradebookState";

/**
 * Phone grading: one assessment at a time down the class list (the keyboard's Next key moves to
 * the next student), or one student at a time with all of their assessments. Inputs are large,
 * decimal-keyboard text fields; the Save bar is docked at the bottom by the parent.
 */
export function MobileGrader({
  students,
  assessments,
  state,
  canEdit,
}: {
  students: StudentSummary[];
  assessments: OfferingAssessmentView[];
  state: GradebookState;
  canEdit: boolean;
}) {
  const t = useTranslations("gradebook");
  const [mode, setMode] = useState<"assessment" | "student">("assessment");
  const [assessmentId, setAssessmentId] = useState(assessments[0]?.id ?? "");
  const [studentIndex, setStudentIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const assessment = assessments.find((a) => a.id === assessmentId) ?? assessments[0];
  const student = students[Math.min(studentIndex, students.length - 1)];

  /** Enter / the keyboard's Next key jumps to the following field instead of submitting. */
  function focusNext(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = [...(listRef.current?.querySelectorAll<HTMLInputElement>("input[data-grade]") ?? [])];
    const next = inputs[inputs.indexOf(e.currentTarget) + 1];
    if (next) next.focus();
    else e.currentTarget.blur();
  }

  function field(s: StudentSummary, a: OfferingAssessmentView, label: React.ReactNode, isLast: boolean) {
    const key = cellKey(s.id, a.id);
    const error = state.invalid.get(key);
    const dirty = state.dirtySet.has(key);
    const id = `m-${key}`;
    return (
      <div key={key} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
        <label htmlFor={id} className="min-w-0 flex-1">
          {label}
          {error && (
            <span id={`${id}-err`} className="mt-0.5 block text-xs font-medium text-risk">
              {t(`errors.${error}`, { max: a.maxPoints * MAX_SCORE_FACTOR })}
            </span>
          )}
        </label>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            {dirty && <span aria-hidden className="absolute top-1.5 -left-2.5 size-1.5 rounded-full bg-warn" />}
            <NumberInput
              id={id}
              data-grade
              value={state.values[key] ?? ""}
              onChange={(e) => state.setCell(key, e.target.value, { undoable: false })}
              onKeyDown={focusNext}
              enterKeyHint={isLast ? "done" : "next"}
              readOnly={!canEdit}
              invalid={!!error}
              aria-describedby={error ? `${id}-err` : undefined}
              className={cn("h-11 w-24 text-base", dirty && !error && "border-warn")}
            />
          </div>
          <span className="w-10 text-xs text-muted tabular">/ {a.maxPoints}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        label={t("gradeBy")}
        value={mode}
        onChange={setMode}
        className="w-full [&>label]:flex-1"
        options={[
          { value: "assessment", label: t("byAssessment"), icon: <ClipboardList aria-hidden /> },
          { value: "student", label: t("byStudent"), icon: <User aria-hidden /> },
        ]}
      />

      {mode === "assessment" && assessment && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">{t("assessment")}</span>
            <Select value={assessment.id} onChange={(e) => setAssessmentId(e.target.value)} className="h-11 w-full">
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} (/{a.maxPoints})
                </option>
              ))}
            </Select>
          </label>
          <div ref={listRef} className="overflow-hidden rounded-xl border border-border bg-surface">
            {students.map((s, i) => {
              const grade = state.preview(s.id);
              return field(
                s,
                assessment,
                <>
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted tabular">
                    {s.studentId}
                    <span className="rounded bg-surface-2 px-1.5 py-px font-medium text-foreground" aria-label={t("courseGradeIs", { letter: grade.letter })}>
                      {grade.letter}
                    </span>
                  </span>
                </>,
                i === students.length - 1,
              );
            })}
          </div>
        </>
      )}

      {mode === "student" && student && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" className="size-11" onClick={() => setStudentIndex((i) => Math.max(0, i - 1))} disabled={studentIndex === 0} aria-label={t("previousStudent")}>
              <ChevronLeft />
            </Button>
            <Select value={student.id} onChange={(e) => setStudentIndex(students.findIndex((s) => s.id === e.target.value))} className="h-11 min-w-0 flex-1" aria-label={t("student")}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              size="icon"
              className="size-11"
              onClick={() => setStudentIndex((i) => Math.min(students.length - 1, i + 1))}
              disabled={studentIndex >= students.length - 1}
              aria-label={t("nextStudent")}
            >
              <ChevronRight />
            </Button>
          </div>
          <p className="text-xs text-muted tabular" aria-live="polite">
            {t("studentPosition", { index: studentIndex + 1, total: students.length })} · {student.studentId} · {t("courseGrade")}{" "}
            <strong className="text-foreground">{state.preview(student.id).letter}</strong>
          </p>
          <div ref={listRef} className="overflow-hidden rounded-xl border border-border bg-surface">
            {assessments.map((a, i) =>
              field(
                student,
                a,
                <>
                  <span className="block truncate font-medium">{a.title}</span>
                  <span className="text-xs text-muted tabular">{a.gradeWeight}%</span>
                </>,
                i === assessments.length - 1,
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
