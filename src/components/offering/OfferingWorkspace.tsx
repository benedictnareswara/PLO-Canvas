"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus, Save, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Stat, Table, Td, Th, cn } from "@/components/ui";
import { Dialog, Notice, Tabs, apiFetch } from "@/components/ui/client";
import { AtRiskBadge, PloCell, formatPct } from "@/components/AtRiskBadge";
import { PloRadar } from "@/components/charts/PloRadar";
import { cohortAggregate, effectivePloWeights, isAtRisk } from "@/lib/obe/engine";
import type { OfferingAssessmentView, OfferingDetail } from "@/lib/obe/queries";
import { PloWeightEditor, type WeightValue } from "./PloWeightEditor";
import { CanvasImportWizard } from "./CanvasImportWizard";

export function OfferingWorkspace({ detail, canEdit, initialTab }: { detail: OfferingDetail; canEdit: boolean; initialTab?: string }) {
  const [importOpen, setImportOpen] = useState(false);
  return (
    <>
      {canEdit && (
        <div className="-mt-3 mb-4 flex justify-end">
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import Canvas CSV
          </Button>
        </div>
      )}
      <Tabs
        initial={initialTab}
        tabs={[
          { key: "radar", label: "Class Radar", content: <ClassRadarTab detail={detail} /> },
          {
            key: "gradebook",
            label: "Gradebook",
            // Remount after a refresh so the grid resets to the saved server values.
            content: <GradebookTab key={JSON.stringify(detail.grades)} detail={detail} canEdit={canEdit} />,
          },
          { key: "assessments", label: `Assessments (${detail.assessments.length})`, content: <AssessmentsTab detail={detail} canEdit={canEdit} /> },
          ...(canEdit ? [{ key: "settings", label: "Settings", content: <SettingsTab detail={detail} /> }] : []),
        ]}
      />
      {canEdit && <CanvasImportWizard open={importOpen} onClose={() => setImportOpen(false)} detail={detail} />}
    </>
  );
}

/* --------------------------------- Radar --------------------------------- */

function ClassRadarTab({ detail }: { detail: OfferingDetail }) {
  const { plos, students, attainment, threshold } = detail;
  const stats = useMemo(
    () =>
      cohortAggregate(
        students.map(
          (s) =>
            new Map(
              Object.entries(attainment[s.id] ?? {})
                .filter(([, v]) => v !== null)
                .map(([k, v]) => [Number(k), v as number]),
            ),
        ),
      ),
    [students, attainment],
  );
  const mean = Object.fromEntries(plos.map((p) => [p.number, stats.get(p.number)?.mean ?? null]));
  const evidenced = plos.filter((p) => stats.has(p.number));
  const riskyPlos = evidenced.filter((p) => isAtRisk(stats.get(p.number)!.mean, threshold));
  const studentsAtRisk = students.filter((s) => Object.values(attainment[s.id] ?? {}).some((v) => isAtRisk(v, threshold)));

  if (!detail.assessments.length) {
    return <EmptyState>No assessments yet. Add assessments or import a Canvas gradebook to see PLO attainment.</EmptyState>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Enrolled students" value={students.length} />
        <Stat label="PLOs measured" value={`${evidenced.length}`} hint={`Curriculum maps PLO ${detail.coursePloNumbers.join(", ")}`} />
        <Stat label="Class PLOs below target" value={riskyPlos.length} tone={riskyPlos.length ? "risk" : "ok"} hint={`Target ${threshold}%`} />
        <Stat label="Students with an at-risk PLO" value={studentsAtRisk.length} tone={studentsAtRisk.length ? "risk" : "ok"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Class mean PLO attainment" description="Mean of each student's course-level PLO attainment" />
          <CardBody>
            <PloRadar plos={plos} threshold={threshold} series={[{ key: "mean", label: "Class mean", values: mean }]} showTable={false} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Achievement distribution" description="Per PLO, across enrolled students" />
          <Table>
            <thead>
              <tr>
                <Th>PLO</Th>
                <Th className="text-right">Mean</Th>
                <Th className="text-right">Min–Max</Th>
                <Th className="text-right">Below</Th>
              </tr>
            </thead>
            <tbody>
              {evidenced.map((p) => {
                const s = stats.get(p.number)!;
                const below = students.filter((st) => isAtRisk(attainment[st.id]?.[p.number], threshold)).length;
                return (
                  <tr key={p.id}>
                    <Td title={p.description}>
                      <span className="font-medium">{p.code}</span>
                    </Td>
                    <Td className="text-right">
                      <AtRiskBadge value={s.mean} threshold={threshold} compact />
                    </Td>
                    <Td className="text-right tabular text-muted">
                      {s.min.toFixed(0)}–{s.max.toFixed(0)}
                    </Td>
                    <Td className={cn("text-right tabular", below && "font-semibold text-risk")}>
                      {below}/{s.n}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card>
        <CardHeader title="Student PLO attainment" description="Course-level PLO attainment for each enrolled student" />
        <Table>
          <thead>
            <tr>
              <Th>Student</Th>
              {evidenced.map((p) => (
                <Th key={p.id} className="text-center" title={p.description}>
                  {p.code}
                </Th>
              ))}
              <Th className="text-right">Course grade</Th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <Td>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted">{s.studentId}</div>
                </Td>
                {evidenced.map((p) => (
                  <Td key={p.id} className="text-center">
                    <PloCell value={attainment[s.id]?.[p.number] ?? null} threshold={threshold} />
                  </Td>
                ))}
                <Td className="text-right tabular">
                  {formatPct(detail.courseGrades[s.id]?.pct)}{" "}
                  <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">{detail.courseGrades[s.id]?.letter}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/* ------------------------------- Gradebook ------------------------------- */

function GradebookTab({ detail, canEdit }: { detail: OfferingDetail; canEdit: boolean }) {
  const router = useRouter();
  const initial = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of detail.students)
      for (const a of detail.assessments) {
        const v = detail.grades[s.id]?.[a.id];
        m[`${s.id}:${a.id}`] = v === undefined ? "" : String(v);
      }
    return m;
  }, [detail]);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const dirty = Object.keys(values).filter((k) => values[k] !== initial[k]);
  const invalid = dirty.filter((k) => {
    const v = values[k].trim();
    const max = detail.assessments.find((a) => a.id === k.split(":")[1])!.maxPoints;
    return v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > max * 1.5);
  });

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const grades = dirty.map((k) => {
        const [student, assessment] = k.split(":");
        const v = values[k].trim();
        return { student, assessment, score: v === "" ? null : Number(v) };
      });
      await apiFetch(`/api/offerings/${detail.id}/grades`, { method: "PUT", body: { grades } });
      setNotice({ tone: "ok", text: `Saved ${grades.length} grade${grades.length === 1 ? "" : "s"}; PLO attainment recalculated.` });
      router.refresh();
    } catch (e) {
      setNotice({ tone: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (!detail.assessments.length) return <EmptyState>Create assessments first, or import them from a Canvas gradebook.</EmptyState>;

  return (
    <Card>
      <CardHeader
        title="Gradebook"
        description={canEdit ? "Enter raw scores. Leave a cell blank for not graded." : "Read-only view"}
        actions={
          canEdit && (
            <>
              {dirty.length > 0 && <span className="text-xs text-muted">{dirty.length} unsaved change(s)</span>}
              <Button variant="secondary" disabled={!dirty.length || saving} onClick={() => setValues(initial)}>
                Discard
              </Button>
              <Button disabled={!dirty.length || invalid.length > 0 || saving} onClick={save}>
                <Save className="size-4" /> {saving ? "Saving…" : "Save grades"}
              </Button>
            </>
          )
        }
      />
      {notice && (
        <div className="px-5 pt-4">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      )}
      <Table>
        <thead>
          <tr>
            <Th className="sticky left-0 z-10 min-w-48">Student</Th>
            {detail.assessments.map((a) => (
              <Th key={a.id} className="min-w-28 text-right normal-case tracking-normal">
                <div className="text-foreground">{a.title}</div>
                <div className="font-normal">/ {a.maxPoints}</div>
              </Th>
            ))}
            <Th className="text-right">Course grade</Th>
          </tr>
        </thead>
        <tbody>
          {detail.students.map((s) => (
            <tr key={s.id}>
              <Td className="sticky left-0 z-10 bg-surface">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted">{s.studentId}</div>
              </Td>
              {detail.assessments.map((a) => {
                const k = `${s.id}:${a.id}`;
                const isDirty = values[k] !== initial[k];
                return (
                  <Td key={a.id} className="text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        inputMode="decimal"
                        aria-label={`${s.name} – ${a.title}`}
                        value={values[k]}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                        className={cn(
                          "ml-auto h-8 w-24 text-right tabular",
                          isDirty && "border-amber-400 bg-amber-50",
                          invalid.includes(k) && "border-risk bg-risk-soft",
                        )}
                      />
                    ) : (
                      <span className="tabular">{values[k] || "—"}</span>
                    )}
                  </Td>
                );
              })}
              <Td className="whitespace-nowrap text-right tabular">
                {formatPct(detail.courseGrades[s.id]?.pct)}{" "}
                <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">{detail.courseGrades[s.id]?.letter}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {invalid.length > 0 && (
        <div className="px-5 py-3">
          <Notice tone="error">Some scores are not valid numbers or exceed 150% of the max points.</Notice>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Assessments ------------------------------ */

function AssessmentsTab({ detail, canEdit }: { detail: OfferingDetail; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<OfferingAssessmentView | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ploById = new Map(detail.plos.map((p) => [p.id, p]));

  const effective = useMemo(
    () =>
      effectivePloWeights(
        detail.assessments.map((a) => ({ id: a.id, maxPoints: a.maxPoints, ploWeights: a.ploWeights.map((w) => ({ plo: w.number, weight: w.weight })) })),
      ),
    [detail.assessments],
  );
  const measured = detail.plos.filter((p) => effective.has(p.number));
  const unmeasured = detail.coursePloNumbers.filter((n) => !effective.has(n));
  const totalGradeWeight = detail.assessments.reduce((s, a) => s + a.gradeWeight, 0);

  async function remove(a: OfferingAssessmentView) {
    if (!confirm(`Delete "${a.title}" and all of its grades? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/offerings/${detail.id}/assessments/${a.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {unmeasured.length > 0 && (
        <Notice tone="info">
          <AlertTriangle className="mr-1 inline size-4" />
          The curriculum maps PLO {unmeasured.join(", ")} to this course, but no assessment measures {unmeasured.length > 1 ? "them" : "it"} yet.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Card>
        <CardHeader
          title="Assessments"
          description={`Grade weights total ${totalGradeWeight}%${totalGradeWeight !== 100 && totalGradeWeight > 0 ? " (normalized when computing the course grade)" : ""}`}
          actions={
            canEdit && (
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-4" /> Add assessment
              </Button>
            )
          }
        />
        {detail.assessments.length === 0 ? (
          <CardBody>
            <EmptyState>No assessments yet.</EmptyState>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th className="text-right">Max points</Th>
                <Th className="text-right">Grade weight</Th>
                <Th>PLO weights</Th>
                <Th>Source</Th>
                {canEdit && <Th />}
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
                      {a.ploWeights.length === 0 && <Badge tone="risk">Not mapped</Badge>}
                      {[...a.ploWeights].sort((x, y) => x.number - y.number).map((w) => (
                        <Badge key={w.plo} tone="info" title={ploById.get(w.plo)?.description}>
                          PLO {w.number} · {w.weight}%
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={a.source === "canvas" ? "brand" : "neutral"}>{a.source === "canvas" ? `Canvas ${a.canvasId ?? ""}` : "Manual"}</Badge>
                  </Td>
                  {canEdit && (
                    <Td className="whitespace-nowrap text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(a)} aria-label={`Delete ${a.title}`}>
                        <Trash2 className="size-3.5 text-risk" />
                      </Button>
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
          <CardHeader
            title="Effective PLO weight matrix"
            description="Each column is normalized to 100%: this is the w(a,k) used in PLO(c,k) = Σ ScorePct(a) × w(a,k)."
          />
          <Table>
            <thead>
              <tr>
                <Th>Assessment</Th>
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
                      <Td key={p.id} className="text-right tabular">
                        {w === undefined ? <span className="text-muted">—</span> : `${w.toFixed(1)}%`}
                      </Td>
                    );
                  })}
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>Total</Td>
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
          assessment={editing === "new" ? null : editing}
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

function AssessmentDialog({
  detail,
  assessment,
  onClose,
  onSaved,
}: {
  detail: OfferingDetail;
  assessment: OfferingAssessmentView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(assessment?.title ?? "");
  const [maxPoints, setMaxPoints] = useState(String(assessment?.maxPoints ?? 100));
  const [gradeWeight, setGradeWeight] = useState(String(assessment?.gradeWeight ?? 0));
  const [weights, setWeights] = useState<WeightValue[]>(assessment?.ploWeights.map((w) => ({ plo: w.plo, weight: w.weight })) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = { title, maxPoints: Number(maxPoints), gradeWeight: Number(gradeWeight || 0), ploWeights: weights };
      if (weights.some((w) => !(w.weight > 0))) throw new Error("Every selected PLO needs a weight greater than 0");
      await apiFetch(`/api/offerings/${detail.id}/assessments${assessment ? `/${assessment.id}` : ""}`, {
        method: assessment ? "PATCH" : "POST",
        body,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={assessment ? "Edit assessment" : "New assessment"}
      description="Weights say how much this assessment contributes to each PLO. Per PLO, weights are normalized across the course's assessments."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim() || !(Number(maxPoints) > 0)}>
            {saving ? "Saving…" : "Save assessment"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm Exam (UTS)" />
          </Field>
          <Field label="Max points">
            <Input type="number" min={0} step="any" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />
          </Field>
          <Field label="Grade weight %">
            <Input type="number" min={0} max={100} step="any" value={gradeWeight} onChange={(e) => setGradeWeight(e.target.value)} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">PLO mapping & weights</div>
          <PloWeightEditor plos={detail.plos} value={weights} onChange={setWeights} highlight={detail.coursePloNumbers} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}

/* -------------------------------- Settings ------------------------------- */

function SettingsTab({ detail }: { detail: OfferingDetail }) {
  const router = useRouter();
  const [threshold, setThreshold] = useState(String(detail.threshold));
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    try {
      await apiFetch(`/api/offerings/${detail.id}`, { method: "PATCH", body: { threshold: Number(threshold) } });
      setNotice({ tone: "ok", text: "Threshold updated." });
      router.refresh();
    } catch (e) {
      setNotice({ tone: "error", text: (e as Error).message });
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader title="Attainment target" description="Course-level PLO values below this benchmark are flagged At-Risk for this class." />
      <CardBody className="space-y-4">
        <div className="flex items-end gap-3">
          <Field label="Passing threshold (%)" className="w-40">
            <Input type="number" min={0} max={100} step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          <Button onClick={save} disabled={!(Number(threshold) >= 0 && Number(threshold) <= 100)}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setThreshold("70")}>
            Reset to 70%
          </Button>
        </div>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      </CardBody>
    </Card>
  );
}
