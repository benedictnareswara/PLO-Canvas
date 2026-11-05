"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Meter, Table, Td, Th, cn } from "@/components/ui";
import { Notice, Tooltip, apiFetch, useConfirm } from "@/components/ui/client";
import { effectivePloWeights } from "@/lib/obe/engine";
import type { OfferingAssessmentView, OfferingDetail } from "@/lib/obe/queries";
import { AssessmentDialog } from "../AssessmentDialog";

type Editing = { assessment: OfferingAssessmentView | null; presetPlo?: string };

export function AssessmentsTab({ detail, canEdit }: { detail: OfferingDetail; canEdit: boolean }) {
  const t = useTranslations("assessments");
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ploById = new Map(detail.plos.map((p) => [p.id, p]));
  const ploByNumber = new Map(detail.plos.map((p) => [p.number, p]));

  const effective = useMemo(
    () =>
      effectivePloWeights(
        detail.assessments.map((a) => ({ id: a.id, maxPoints: a.maxPoints, ploWeights: a.ploWeights.map((w) => ({ plo: w.number, weight: w.weight })) })),
      ),
    [detail.assessments],
  );
  const measured = detail.plos.filter((p) => effective.has(p.number));
  const unmeasured = detail.coursePloNumbers.filter((n) => !effective.has(n));
  const totalGradeWeight = Math.round(detail.assessments.reduce((s, a) => s + a.gradeWeight, 0) * 100) / 100;
  const weightsOk = Math.abs(totalGradeWeight - 100) < 0.01;

  async function remove(a: OfferingAssessmentView) {
    const graded = detail.students.filter((s) => detail.grades[s.id]?.[a.id] !== undefined).length;
    const ok = await confirm({
      title: t("deleteTitle", { title: a.title }),
      body: graded ? t("deleteBodyGrades", { count: graded }) : t("deleteBodyEmpty"),
      confirmLabel: t("deleteAction"),
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/api/offerings/${detail.id}/assessments/${a.id}`, { method: "DELETE" });
      toast.success(t("deleted", { title: a.title }), { description: t("recalculated") });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {unmeasured.length > 0 && (
        <Notice
          tone="warn"
          action={
            canEdit &&
            unmeasured.slice(0, 3).map((n) => (
              <Button key={n} size="sm" variant="secondary" onClick={() => setEditing({ assessment: null, presetPlo: ploByNumber.get(n)?.id })}>
                <Plus aria-hidden /> {t("addForPlo", { plo: ploByNumber.get(n)?.code ?? `PLO ${n}` })}
              </Button>
            ))
          }
        >
          {t("unmeasured", { count: unmeasured.length, list: unmeasured.map((n) => ploByNumber.get(n)?.code ?? n).join(", ") })}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Card>
        <CardHeader
          title={t("title")}
          description={
            detail.assessments.length > 0 && (
              <span className="mt-1.5 flex max-w-sm flex-col gap-1.5">
                <span className={cn("tabular", !weightsOk && "text-warn")}>
                  {t("weightTotal", { total: totalGradeWeight })}
                  {!weightsOk && totalGradeWeight > 0 && ` · ${t("weightNormalized")}`}
                </span>
                <Meter value={totalGradeWeight} target={100} tone={weightsOk ? "ok" : "brand"} label={t("weightTotal", { total: totalGradeWeight })} />
              </span>
            )
          }
          actions={
            canEdit && (
              <Button onClick={() => setEditing({ assessment: null })}>
                <Plus aria-hidden /> {t("add")}
              </Button>
            )
          }
        />
        {detail.assessments.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ClipboardList />}
              title={t("emptyTitle")}
              description={t("emptyBody")}
              action={
                canEdit && (
                  <Button onClick={() => setEditing({ assessment: null })}>
                    <Plus aria-hidden /> {t("add")}
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table label={t("title")}>
            <thead>
              <tr>
                <Th>{t("colTitle")}</Th>
                <Th className="text-right">{t("colMax")}</Th>
                <Th className="text-right">{t("colWeight")}</Th>
                <Th>{t("colPlos")}</Th>
                <Th>{t("colSource")}</Th>
                {canEdit && (
                  <Th>
                    <span className="sr-only">{t("colActions")}</span>
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {detail.assessments.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium">{a.title}</Td>
                  <Td className="text-right tabular">{a.maxPoints}</Td>
                  <Td className="text-right tabular">{a.gradeWeight}%</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {a.ploWeights.length === 0 && <Badge tone="risk">{t("notMapped")}</Badge>}
                      {[...a.ploWeights]
                        .sort((x, y) => x.number - y.number)
                        .map((w) => (
                          <Badge key={w.plo} tone="info" title={ploById.get(w.plo)?.description}>
                            {ploById.get(w.plo)?.code ?? `PLO ${w.number}`} · {w.weight}%
                          </Badge>
                        ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={a.source === "canvas" ? "brand" : "neutral"}>{a.source === "canvas" ? `Canvas ${a.canvasId ?? ""}` : t("manual")}</Badge>
                  </Td>
                  {canEdit && (
                    <Td className="text-right whitespace-nowrap">
                      <Tooltip content={t("edit")}>
                        <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ assessment: a })} aria-label={t("editNamed", { title: a.title })}>
                          <Pencil />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("delete")}>
                        <Button size="icon-sm" variant="danger-ghost" onClick={() => remove(a)} aria-label={t("deleteNamed", { title: a.title })}>
                          <Trash2 />
                        </Button>
                      </Tooltip>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {measured.length > 0 && (
        <Card>
          <CardHeader title={t("matrixTitle")} description={t("matrixDescription")} />
          <Table label={t("matrixTitle")}>
            <thead>
              <tr>
                <Th>{t("colTitle")}</Th>
                {measured.map((p) => (
                  <Th key={p.id} className="text-right" title={p.description}>
                    {p.code}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.assessments.map((a) => (
                <tr key={a.id}>
                  <Td>{a.title}</Td>
                  {measured.map((p) => {
                    const w = effective.get(p.number)?.get(a.id);
                    return (
                      <Td
                        key={p.id}
                        className="text-right tabular"
                        // Heatmap tint scales with the weight; the number is always written, so colour is never the only signal.
                        style={w !== undefined ? { background: `color-mix(in oklab, var(--brand) ${Math.round(4 + (w / 100) * 30)}%, var(--surface))` } : undefined}
                      >
                        {w === undefined ? <span className="text-subtle">—</span> : `${w.toFixed(1)}%`}
                      </Td>
                    );
                  })}
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>{t("total")}</Td>
                {measured.map((p) => (
                  <Td key={p.id} className="text-right tabular">
                    100%
                  </Td>
                ))}
              </tr>
            </tbody>
          </Table>
        </Card>
      )}

      {editing && (
        <AssessmentDialog
          detail={detail}
          assessment={editing.assessment}
          presetPlo={editing.presetPlo}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
