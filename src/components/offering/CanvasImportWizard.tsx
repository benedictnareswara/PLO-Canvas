"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, FileUp } from "lucide-react";
import { Badge, Button, Input, Stat, Table, Td, Th, cn } from "@/components/ui";
import { Dialog, Notice, apiFetch } from "@/components/ui/client";
import { parseCanvasGradebook, type ParsedCanvasGradebook } from "@/lib/canvas/parse";
import type { OfferingDetail } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";
import type { WeightValue } from "./PloWeightEditor";

interface MappingRow {
  key: string;
  title: string;
  canvasId: string | null;
  maxPoints: string;
  gradedCount: number;
  include: boolean;
  gradeWeight: string;
  weights: WeightValue[];
  existing: boolean;
}

interface Report {
  matches: { name: string; sisLoginId: string; sisUserId: string; userId: string | null; userName: string | null; matchedBy: string | null; enrolled: boolean }[];
  summary: { matched: number; unenrolled: number; unmatched: number };
  assessments: { key: string; title: string; action: "create" | "update" }[];
  written?: { assessmentsCreated: number; assessmentsUpdated: number; gradesWritten: number; enrolled: number; blankCells: number };
  transactional?: boolean;
}

const STEPS = ["Upload", "Map to PLOs", "Review", "Done"];

export function CanvasImportWizard({ open, onClose, detail }: { open: boolean; onClose: () => void; detail: OfferingDetail }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCanvasGradebook | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [enrollUnenrolled, setEnrollUnenrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep(0);
    setFileName(null);
    setParsed(null);
    setRows([]);
    setReport(null);
    setEnrollUnenrolled(false);
    setError(null);
  }

  function close() {
    if (report?.written) router.refresh();
    reset();
    onClose();
  }

  async function onFile(file: File) {
    setError(null);
    if (!/\.csv$/i.test(file.name)) return setError("Please choose a .csv file exported from the Canvas Gradebook.");
    try {
      const result = parseCanvasGradebook(await file.text());
      if (!result.assignments.length) throw new Error("No assignment columns were found in this file.");
      const existing = new Map(detail.assessments.filter((a) => a.canvasId).map((a) => [a.canvasId!, a]));
      setFileName(file.name);
      setParsed(result);
      setRows(
        result.assignments.map((a) => {
          const prev = a.canvasId ? existing.get(a.canvasId) : undefined;
          return {
            key: a.key,
            title: a.title,
            canvasId: a.canvasId,
            maxPoints: String(a.maxPoints ?? prev?.maxPoints ?? ""),
            gradedCount: a.gradedCount,
            include: a.gradedCount > 0,
            gradeWeight: String(prev?.gradeWeight ?? 0),
            weights: prev?.ploWeights.map((w) => ({ plo: w.plo, weight: w.weight })) ?? [],
            existing: Boolean(prev),
          };
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const included = rows.filter((r) => r.include);
  const rowErrors = (r: MappingRow): string | null => {
    if (!(Number(r.maxPoints) > 0)) return "Max points required";
    if (!r.weights.length) return "Map at least one PLO";
    if (r.weights.some((w) => !(w.weight > 0))) return "Weights must be > 0";
    const total = r.weights.reduce((s, w) => s + w.weight, 0);
    if (Math.abs(total - 100) > 0.01) return `Weights total ${Math.round(total * 100) / 100}% (needs 100%)`;
    return null;
  };
  const mappingValid = included.length > 0 && included.every((r) => !rowErrors(r));

  function payload(dryRun: boolean) {
    return {
      dryRun,
      enrollUnenrolled,
      assessments: included.map((r) => ({
        key: r.key,
        title: r.title.trim(),
        canvasId: r.canvasId,
        maxPoints: Number(r.maxPoints),
        gradeWeight: Number(r.gradeWeight || 0),
        ploWeights: r.weights,
      })),
      students: parsed!.students.map((s) => ({
        name: s.name,
        canvasUserId: s.canvasUserId,
        sisUserId: s.sisUserId,
        sisLoginId: s.sisLoginId,
        scores: Object.fromEntries(included.map((r) => [r.key, s.scores[r.key] ?? null])),
      })),
    };
  }

  async function submit(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<Report>(`/api/offerings/${detail.id}/import`, { body: payload(dryRun) });
      setReport(res);
      setStep(dryRun ? 2 : 3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const update = (key: string, patch: Partial<MappingRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const importable = report ? report.summary.matched + (enrollUnenrolled ? report.summary.unenrolled : 0) : 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      size="xl"
      title="Import Canvas gradebook"
      description={`${detail.code} · ${detail.title} · ${detail.period}`}
      footer={
        <>
          {step === 0 && (
            <Button onClick={() => setStep(1)} disabled={!parsed}>
              Continue to mapping
            </Button>
          )}
          {step === 1 && (
            <>
              <Button variant="secondary" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={() => submit(true)} disabled={!mappingValid || busy}>
                {busy ? "Checking…" : "Review import"}
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => submit(false)} disabled={busy || importable === 0}>
                {busy ? "Importing…" : `Confirm import for ${importable} student${importable === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
          {step === 3 && <Button onClick={close}>Close</Button>}
        </>
      }
    >
      <ol className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                i < step ? "bg-ok text-white" : i === step ? "bg-brand text-white" : "bg-background text-muted",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={i === step ? "font-medium" : "text-muted"}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {step === 0 && <UploadStep fileName={fileName} parsed={parsed} onFile={onFile} />}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Choose which Canvas columns to import and map each to one or more PLOs. Weights split the assessment across PLOs and must total
            100% (e.g. 60% PLO 4 / 40% PLO 7). Course PLOs from the curriculum: <strong>PLO {detail.coursePloNumbers.join(", ")}</strong>.
          </p>
          <Table>
            <thead>
              <tr>
                <Th className="w-10">Import</Th>
                <Th>Assignment</Th>
                <Th className="text-right">Max pts</Th>
                <Th className="text-right">Graded</Th>
                <Th className="min-w-72">PLO mapping & weights</Th>
                <Th className="text-right">Grade wt %</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const err = r.include ? rowErrors(r) : null;
                return (
                  <tr key={r.key} className={cn(!r.include && "opacity-50")}>
                    <Td>
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={r.include}
                        aria-label={`Import ${r.title}`}
                        onChange={(e) => update(r.key, { include: e.target.checked })}
                      />
                    </Td>
                    <Td>
                      <Input value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} className="h-8 min-w-44" disabled={!r.include} />
                      <div className="mt-1 flex gap-1 text-xs text-muted">
                        Canvas ID {r.canvasId ?? "—"}
                        {r.existing && <Badge tone="brand">updates existing</Badge>}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={r.maxPoints}
                        onChange={(e) => update(r.key, { maxPoints: e.target.value })}
                        className="ml-auto h-8 w-20 text-right"
                        disabled={!r.include}
                        aria-label={`${r.title} max points`}
                      />
                    </Td>
                    <Td className="text-right tabular">
                      {r.gradedCount}/{parsed?.students.length ?? 0}
                    </Td>
                    <Td>
                      {r.include && (
                        <>
                          <PloMultiSelect plos={detail.plos} value={r.weights} highlight={detail.coursePloNumbers} onChange={(weights) => update(r.key, { weights })} />
                          {err && <div className="mt-1 text-xs font-medium text-risk">{err}</div>}
                        </>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={r.gradeWeight}
                        onChange={(e) => update(r.key, { gradeWeight: e.target.value })}
                        className="ml-auto h-8 w-20 text-right"
                        disabled={!r.include}
                        aria-label={`${r.title} grade weight`}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {parsed && parsed.skippedColumns.length > 0 && (
            <p className="text-xs text-muted">Ignored computed columns: {parsed.skippedColumns.join(", ")}</p>
          )}
        </div>
      )}

      {step === 2 && report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Matched & enrolled" value={report.summary.matched} tone="ok" />
            <Stat label="Matched, not enrolled" value={report.summary.unenrolled} />
            <Stat label="Unmatched rows" value={report.summary.unmatched} tone={report.summary.unmatched ? "risk" : undefined} />
            <Stat
              label="Assessments"
              value={report.assessments.length}
              hint={`${report.assessments.filter((a) => a.action === "create").length} new · ${report.assessments.filter((a) => a.action === "update").length} updated`}
            />
          </div>
          {report.summary.unenrolled > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand" checked={enrollUnenrolled} onChange={(e) => setEnrollUnenrolled(e.target.checked)} />
              Enroll the {report.summary.unenrolled} matched student(s) who are not yet enrolled in this class
            </label>
          )}
          {report.summary.unmatched > 0 && (
            <Notice tone="info">Unmatched rows will be skipped. Check that the student exists in the registry with the same email or student ID (NIM).</Notice>
          )}
          <Table>
            <thead>
              <tr>
                <Th>Canvas student</Th>
                <Th>SIS Login ID</Th>
                <Th>SIS User ID</Th>
                <Th>Registry match</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {report.matches.map((m, i) => (
                <tr key={i}>
                  <Td>{m.name}</Td>
                  <Td className="text-muted">{m.sisLoginId || "—"}</Td>
                  <Td className="text-muted">{m.sisUserId || "—"}</Td>
                  <Td>
                    {m.userName ?? "—"}
                    {m.matchedBy && <span className="ml-1 text-xs text-muted">(by {m.matchedBy === "email" ? "email" : "NIM"})</span>}
                  </Td>
                  <Td>
                    {!m.userId ? (
                      <Badge tone="risk">Unmatched, skipped</Badge>
                    ) : m.enrolled ? (
                      <Badge tone="ok">Will import</Badge>
                    ) : enrollUnenrolled ? (
                      <Badge tone="brand">Will enroll + import</Badge>
                    ) : (
                      <Badge>Not enrolled, skipped</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {step === 3 && report?.written && (
        <div className="space-y-4">
          <Notice tone="ok">
            Import complete{report.transactional ? " (single MongoDB transaction)" : ""}. PLO attainment for this class was recalculated.
          </Notice>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Assessments created" value={report.written.assessmentsCreated} />
            <Stat label="Assessments updated" value={report.written.assessmentsUpdated} />
            <Stat label="Grades written" value={report.written.gradesWritten} tone="ok" />
            <Stat label="Blank / excused cells skipped" value={report.written.blankCells} hint={report.written.enrolled ? `${report.written.enrolled} student(s) enrolled` : undefined} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

function UploadStep({ fileName, parsed, onFile }: { fileName: string | null; parsed: ParsedCanvasGradebook | null; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center",
          drag ? "border-brand bg-brand-soft" : "border-border",
        )}
      >
        <FileUp className="mb-2 size-8 text-muted" />
        <p className="text-sm font-medium">Drop a Canvas gradebook export here</p>
        <p className="mb-3 text-xs text-muted">Canvas → Grades → Export → Export Entire Gradebook (.csv)</p>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {parsed && (
        <div className="space-y-2">
          <Notice tone="ok">
            <strong>{fileName}</strong>: {parsed.assignments.length} assignment column(s) and {parsed.students.length} student row(s) detected.
          </Notice>
          {parsed.warnings.map((w) => (
            <Notice key={w} tone="info">
              {w}
            </Notice>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dropdown with PLO checkboxes, followed by one weight input per selected PLO. */
function PloMultiSelect({
  plos,
  value,
  onChange,
  highlight,
}: {
  plos: PloInfo[];
  value: WeightValue[];
  onChange: (v: WeightValue[]) => void;
  highlight: number[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const byId = new Map(plos.map((p) => [p.id, p]));
  const selected = new Map(value.map((v) => [v.plo, v.weight]));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // The panel is fixed-positioned (the table scrolls), so close it when anything scrolls.
    const onScroll = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function toggleOpen() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.max(rect.width, 320);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      const below = window.innerHeight - rect.bottom;
      setPos(
        below > 300
          ? { top: rect.bottom + 4, left, width }
          : { bottom: window.innerHeight - rect.top + 4, left, width, maxHeight: Math.max(160, rect.top - 16) },
      );
    }
    setOpen((o) => !o);
  }

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(value.filter((v) => v.plo !== id));
    } else {
      // Re-split evenly so the common case needs no typing.
      const next = [...value.map((v) => v.plo), id];
      const even = Math.floor((100 / next.length) * 100) / 100;
      onChange(next.map((plo, i) => ({ plo, weight: i === 0 ? Math.round((100 - even * (next.length - 1)) * 100) / 100 : even })));
    }
  }

  const sorted = [...value].sort((a, b) => (byId.get(a.plo)?.number ?? 0) - (byId.get(b.plo)?.number ?? 0));

  return (
    <div className="space-y-1.5">
      <div ref={ref} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 text-left text-sm"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={cn("truncate", !value.length && "text-muted")}>
            {value.length ? sorted.map((v) => byId.get(v.plo)?.code).join(", ") : "Select PLOs…"}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
        {open && (
          <div
            role="listbox"
            aria-multiselectable
            style={pos}
            className="fixed z-50 max-h-72 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-lg"
          >
            {plos.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-background" title={p.description}>
                <input type="checkbox" className="mt-0.5 accent-brand" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                <span>
                  <span className="font-medium">{p.code}</span> <span className="text-xs text-muted">{p.shortLabel}</span>
                  {highlight.includes(p.number) && (
                    <Badge tone="info" className="ml-1">
                      course PLO
                    </Badge>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((v) => (
            <span key={v.plo} className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-xs">
              {byId.get(v.plo)?.code}
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                aria-label={`${byId.get(v.plo)?.code} weight`}
                value={Number.isFinite(v.weight) ? v.weight : ""}
                onChange={(e) =>
                  onChange(value.map((w) => (w.plo === v.plo ? { ...w, weight: e.target.value === "" ? NaN : Number(e.target.value) } : w)))
                }
                className="h-6 w-14 rounded border border-border bg-surface px-1 text-right tabular"
              />
              %
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
