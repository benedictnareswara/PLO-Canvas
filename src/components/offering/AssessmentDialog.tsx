"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Field, Input, NumberInput } from "@/components/ui";
import { Dialog, apiFetch } from "@/components/ui/client";
import { parseScore } from "@/lib/gradebook/parse-score";
import type { OfferingAssessmentView, OfferingDetail } from "@/lib/obe/queries";
import { PloWeightEditor, type WeightValue } from "./PloWeightEditor";

type FieldName = "title" | "maxPoints" | "gradeWeight" | "weights";

/**
 * Create or edit an assessment. Fields validate once the user has left them (or after a submit
 * attempt); a failed submit shows an error summary that links to each field (GOV.UK pattern).
 */
export function AssessmentDialog({
  detail,
  assessment,
  presetPlo,
  onClose,
  onSaved,
}: {
  detail: OfferingDetail;
  assessment: OfferingAssessmentView | null;
  /** PLO to pre-select at 100% (from "Add an assessment for PLO 9"). */
  presetPlo?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("assessments.dialog");
  const [initial] = useState(() => ({
    title: assessment?.title ?? "",
    maxPoints: String(assessment?.maxPoints ?? 100),
    gradeWeight: String(assessment?.gradeWeight ?? 0),
    weights: assessment?.ploWeights.map((w) => ({ plo: w.plo, weight: w.weight })) ?? (presetPlo ? [{ plo: presetPlo, weight: 100 }] : []),
  }));
  const [title, setTitle] = useState(initial.title);
  const [maxPoints, setMaxPoints] = useState(initial.maxPoints);
  const [gradeWeight, setGradeWeight] = useState(initial.gradeWeight);
  const [weights, setWeights] = useState<WeightValue[]>(initial.weights);
  const [touched, setTouched] = useState<Set<FieldName>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const max = parseScore(maxPoints);
  const gw = parseScore(gradeWeight || "0");
  const errors: Partial<Record<FieldName, string>> = {};
  if (!title.trim()) errors.title = t("errors.title");
  if (max === null || Number.isNaN(max) || !(max > 0)) errors.maxPoints = t("errors.maxPoints");
  if (gw === null || Number.isNaN(gw) || gw < 0 || gw > 100) errors.gradeWeight = t("errors.gradeWeight");
  if (weights.some((w) => !(w.weight > 0) || w.weight > 100)) errors.weights = t("errors.weights");

  const show = (f: FieldName) => (attempted || touched.has(f) ? errors[f] : undefined);
  const touch = (f: FieldName) => setTouched((s) => new Set(s).add(f));
  const dirty =
    title !== initial.title ||
    maxPoints !== initial.maxPoints ||
    gradeWeight !== initial.gradeWeight ||
    JSON.stringify(weights) !== JSON.stringify(initial.weights);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (Object.keys(errors).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/offerings/${detail.id}/assessments${assessment ? `/${assessment.id}` : ""}`, {
        method: assessment ? "PATCH" : "POST",
        body: { title: title.trim(), maxPoints: max, gradeWeight: gw, ploWeights: weights },
      });
      toast.success(assessment ? t("updated", { title: title.trim() }) : t("created", { title: title.trim() }), { description: t("recalculated") });
      onSaved();
    } catch (err) {
      setServerError((err as Error).message);
      setSaving(false);
    }
  }

  const summary = attempted && Object.keys(errors).length > 0;
  const fieldIds: Record<FieldName, string> = { title: "as-title", maxPoints: "as-max", gradeWeight: "as-gw", weights: "as-weights" };

  return (
    <Dialog
      open
      onClose={onClose}
      dirty={dirty && !saving}
      size="lg"
      variant="sheet"
      title={assessment ? t("editTitle") : t("newTitle")}
      description={t("description")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="assessment-form" loading={saving}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id="assessment-form" onSubmit={submit} noValidate className="space-y-4">
        {(summary || serverError) && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-lg border-2 border-risk/60 bg-risk-soft p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-risk/40">
            <p className="font-semibold text-risk">{serverError ? t("serverError") : t("summaryTitle")}</p>
            {serverError ? (
              <p className="mt-1">{serverError}</p>
            ) : (
              <ul className="mt-1 list-inside list-disc">
                {(Object.keys(errors) as FieldName[]).map((f) => (
                  <li key={f}>
                    <a href={`#${fieldIds[f]}`} className="text-risk underline underline-offset-2" onClick={(e) => (e.preventDefault(), document.getElementById(fieldIds[f])?.focus())}>
                      {errors[f]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
          <Field label={t("title")} htmlFor={fieldIds.title} error={show("title")}>
            <Input
              id={fieldIds.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => touch("title")}
              placeholder={t("titlePlaceholder")}
              invalid={!!show("title")}
              aria-describedby={show("title") ? `${fieldIds.title}-error` : undefined}
              data-autofocus
            />
          </Field>
          <Field label={t("maxPoints")} htmlFor={fieldIds.maxPoints} error={show("maxPoints")}>
            <NumberInput
              id={fieldIds.maxPoints}
              value={maxPoints}
              onChange={(e) => setMaxPoints(e.target.value)}
              onBlur={() => touch("maxPoints")}
              invalid={!!show("maxPoints")}
              aria-describedby={show("maxPoints") ? `${fieldIds.maxPoints}-error` : undefined}
            />
          </Field>
          <Field label={t("gradeWeight")} htmlFor={fieldIds.gradeWeight} error={show("gradeWeight")}>
            <NumberInput
              id={fieldIds.gradeWeight}
              value={gradeWeight}
              onChange={(e) => setGradeWeight(e.target.value)}
              onBlur={() => touch("gradeWeight")}
              invalid={!!show("gradeWeight")}
              aria-describedby={show("gradeWeight") ? `${fieldIds.gradeWeight}-error` : undefined}
            />
          </Field>
        </div>
        <fieldset id={fieldIds.weights} tabIndex={-1} className="outline-none">
          <legend className="mb-1.5 text-xs font-medium text-muted">{t("mapping")}</legend>
          <p className="mb-2 text-xs text-subtle">{t("mappingHint")}</p>
          <PloWeightEditor
            plos={detail.plos}
            value={weights}
            onChange={(w) => {
              setWeights(w);
              touch("weights");
            }}
            highlight={detail.coursePloNumbers}
            invalid={!!show("weights")}
          />
          {show("weights") && <p className="mt-1.5 text-xs font-medium text-risk">{show("weights")}</p>}
        </fieldset>
      </form>
    </Dialog>
  );
}
