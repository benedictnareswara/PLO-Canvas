"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ChevronDown, FileUp } from "lucide-react";
import { Badge, Button, Input, NumberInput, SummaryStrip, Table, Td, Th, ToggleChip, cn } from "@/components/ui";
import { Dialog, Notice, apiFetch } from "@/components/ui/client";
import { parseCanvasGradebook, type ParsedCanvasGradebook } from "@/lib/canvas/parse";
import { parseScore } from "@/lib/gradebook/parse-score";
import type { OfferingDetail } from "@/lib/obe/queries";
import type { PloInfo } from "@/lib/obe/types";
import { splitEvenly, type WeightValue } from "./PloWeightEditor";

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

type RowError = "maxPoints" | "noPlo" | "weightZero" | "weightTotal";

export function CanvasImportWizard({ open, onClose, detail }: { open: boolean; onClose: () => void; detail: OfferingDetail }) {
  const t = useTranslations("importer");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCanvasGradebook | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [enrollUnenrolled, setEnrollUnenrolled] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "write" | null>(null);
  const steps = [t("steps.upload"), t("steps.map"), t("steps.review"), t("steps.done")];

  function reset() {
    setStep(0);
    setFileName(null);
    setParsed(null);
    setRows([]);
    setReport(null);
    setEnrollUnenrolled(false);
    setAttentionOnly(false);
    setError(null);
  }

  function close() {
    if (report?.written) router.refresh();
    reset();
    onClose();
  }

  async function onFile(file: File) {
    setError(null);
    if (!/\.csv$/i.test(file.name)) return setError(t("errors.notCsv"));
    try {
      const result = parseCanvasGradebook(await file.text());
      if (!result.assignments.length) throw new Error(t("errors.noColumns"));
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
  const rowError = (r: MappingRow): RowError | null => {
    const max = parseScore(r.maxPoints);
    if (max === null || !(max > 0)) return "maxPoints";
    if (!r.weights.length) return "noPlo";
    if (r.weights.some((w) => !(w.weight > 0))) return "weightZero";
    if (Math.abs(r.weights.reduce((s, w) => s + w.weight, 0) - 100) > 0.01) return "weightTotal";
    return null;
  };
  const needingAttention = included.filter((r) => rowError(r));
  const mappingValid = included.length > 0 && needingAttention.length === 0;
  const visibleRows = attentionOnly ? rows.filter((r) => r.include && rowError(r)) : rows;

  function payload(dryRun: boolean) {
    return {
      dryRun,
      enrollUnenrolled,
      assessments: included.map((r) => ({
        key: r.key,
        title: r.title.trim(),
        canvasId: r.canvasId,
        maxPoints: parseScore(r.maxPoints),
        gradeWeight: parseScore(r.gradeWeight || "0") ?? 0,
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
    setBusy(dryRun ? "check" : "write");
    setError(null);
    try {
      const res = await apiFetch<Report>(`/api/offerings/${detail.id}/import`, { body: payload(dryRun) });
      setReport(res);
      setStep(dryRun ? 2 : 3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const update = (key: string, patch: Partial<MappingRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const importable = report ? report.summary.matched + (enrollUnenrolled ? report.summary.unenrolled : 0) : 0;
  const created = report?.assessments.filter((a) => a.action === "create").length ?? 0;
  const updated = report?.assessments.filter((a) => a.action === "update").length ?? 0;
  const cellsToWrite = importable * included.length;

  return (
    <Dialog
      open={open}
      onClose={close}
      dirty={step > 0 && step < 3 && busy === null}
      size="xl"
      variant="sheet"
      title={t("title")}
      description={`${detail.code} · ${detail.title} · ${detail.period}`}
      footer={
        <>
          {step === 0 && (
            <Button onClick={() => setStep(1)} disabled={!parsed}>
              {t("continue")} <ArrowRight aria-hidden />
            </Button>
          )}
          {step === 1 && (
            <>
              <Button variant="secondary" onClick={() => setStep(0)}>
                {t("back")}
              </Button>
              <Button onClick={() => submit(true)} disabled={!mappingValid} loading={busy === "check"}>
                {t("review")}
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="secondary" onClick={() => setStep(1)} disabled={busy !== null}>
                {t("back")}
              </Button>
              <Button onClick={() => submit(false)} disabled={importable === 0} loading={busy === "write"}>
                {t("confirm", { count: importable })}
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="secondary" onClick={close}>
                {t("close")}
              </Button>
              <Button
                onClick={() => {
                  close();
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "gradebook");
                  router.replace(`${url.pathname}${url.search}`, { scroll: false });
                }}
              >
                {t("viewGradebook")}
              </Button>
            </>
          )}
        </>
      }
    >
      <ol aria-label={t("progress")} className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                i < step ? "bg-ok text-solid-fg" : i === step ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted",
              )}
            >
              {i < step ? <Check className="size-3.5" aria-label={t("stepDone")} /> : i + 1}
            </span>
            <span className={i === step ? "font-medium" : "text-muted"}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border" />}
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
          <p className="text-sm text-muted">{t("mapIntro", { plos: detail.coursePloNumbers.join(", ") })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip checked={attentionOnly} onChange={setAttentionOnly} disabled={!needingAttention.length && !attentionOnly}>
              {t("needsAttention", { count: needingAttention.length })}
            </ToggleChip>
            <span className="text-xs text-muted">{t("includedCount", { count: included.length, total: rows.length })}</span>
          </div>
          <Table label={t("steps.map")}>
            <thead>
              <tr>
                <Th className="w-10">{t("colImport")}</Th>
                <Th>{t("colAssignment")}</Th>
                <Th className="text-right">{t("colMax")}</Th>
                <Th className="text-right">{t("colGraded")}</Th>
                <Th className="min-w-72">{t("colMapping")}</Th>
                <Th className="text-right">{t("colWeight")}</Th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const err = r.include ? rowError(r) : null;
                return (
                  <tr key={r.key} className={cn(!r.include && "opacity-60")}>
                    <Td>
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={r.include}
                        aria-label={t("importNamed", { title: r.title })}
                        onChange={(e) => update(r.key, { include: e.target.checked })}
                      />
                    </Td>
                    <Td>
                      <Input
                        value={r.title}
                        onChange={(e) => update(r.key, { title: e.target.value })}
                        className="h-8 min-w-44"
                        disabled={!r.include}
                        aria-label={t("titleFor", { title: r.title })}
                      />
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                        Canvas ID {r.canvasId ?? "—"}
                        {r.existing && <Badge tone="brand">{t("updatesExisting")}</Badge>}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <NumberInput
                        value={r.maxPoints}
                        onChange={(e) => update(r.key, { maxPoints: e.target.value })}
                        className="ml-auto h-8 w-20"
                        disabled={!r.include}
                        invalid={err === "maxPoints"}
                        aria-label={t("maxFor", { title: r.title })}
                      />
                    </Td>
                    <Td className="text-right tabular">
                      {r.gradedCount}/{parsed?.students.length ?? 0}
                    </Td>
                    <Td>
                      {r.include && (
                        <>
                          <PloMultiSelect plos={detail.plos} value={r.weights} highlight={detail.coursePloNumbers} onChange={(weights) => update(r.key, { weights })} />
                          {err && err !== "maxPoints" && (
                            <div className="mt-1 text-xs font-medium text-risk">
                              {t(`rowErrors.${err}`, { total: Math.round(r.weights.reduce((s, w) => s + w.weight, 0) * 100) / 100 })}
                            </div>
                          )}
                        </>
                      )}
                    </Td>
                    <Td className="text-right">
                      <NumberInput
                        value={r.gradeWeight}
                        onChange={(e) => update(r.key, { gradeWeight: e.target.value })}
                        className="ml-auto h-8 w-20"
                        disabled={!r.include}
                        aria-label={t("weightFor", { title: r.title })}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {parsed && parsed.skippedColumns.length > 0 && <p className="text-xs text-muted">{t("skipped", { list: parsed.skippedColumns.join(", ") })}</p>}
        </div>
      )}

      {step === 2 && report && (
        <div className="space-y-4">
          <SummaryStrip
            className="mb-0"
            items={[
              { label: t("summary.assessments"), value: `${detail.assessments.length} → ${detail.assessments.length + created}`, hint: t("summary.assessmentsHint", { created, updated }) },
              { label: t("summary.matched"), value: report.summary.matched, tone: "ok" },
              { label: t("summary.unenrolled"), value: report.summary.unenrolled, hint: enrollUnenrolled ? t("summary.willEnroll") : t("summary.willSkip") },
              { label: t("summary.unmatched"), value: report.summary.unmatched, tone: report.summary.unmatched ? "risk" : undefined, hint: t("summary.willSkip") },
            ]}
          />
          <p className="text-sm text-muted">{t("summary.cells", { count: cellsToWrite })}</p>
          {report.summary.unenrolled > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand" checked={enrollUnenrolled} onChange={(e) => setEnrollUnenrolled(e.target.checked)} />
              {t("enroll", { count: report.summary.unenrolled })}
            </label>
          )}
          {report.summary.unmatched > 0 && <Notice tone="info">{t("unmatchedHelp")}</Notice>}
          {busy === "write" && (
            <div role="status" className="space-y-1.5">
              <p className="text-sm font-medium">{t("writing", { count: cellsToWrite })}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="ui-indeterminate h-full w-1/3 rounded-full bg-brand" />
              </div>
            </div>
          )}
          <Table label={t("steps.review")} maxHeight="22rem">
            <thead>
              <tr>
                <Th className="sticky top-0">{t("colStudent")}</Th>
                <Th className="sticky top-0">SIS Login ID</Th>
                <Th className="sticky top-0">SIS User ID</Th>
                <Th className="sticky top-0">{t("colMatch")}</Th>
                <Th className="sticky top-0">{t("colStatus")}</Th>
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
                    {m.matchedBy && <span className="ml-1 text-xs text-muted">({m.matchedBy === "email" ? t("byEmail") : t("byNim")})</span>}
                  </Td>
                  <Td>
                    {!m.userId ? (
                      <Badge tone="risk">{t("status.unmatched")}</Badge>
                    ) : m.enrolled ? (
                      <Badge tone="ok">{t("status.import")}</Badge>
                    ) : enrollUnenrolled ? (
                      <Badge tone="brand">{t("status.enroll")}</Badge>
                    ) : (
                      <Badge>{t("status.skip")}</Badge>
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
          <Notice tone="ok">{report.transactional ? t("doneTransactional") : t("done")}</Notice>
          <SummaryStrip
            className="mb-0"
            items={[
              { label: t("result.created"), value: report.written.assessmentsCreated },
              { label: t("result.updated"), value: report.written.assessmentsUpdated },
              { label: t("result.grades"), value: report.written.gradesWritten, tone: "ok" },
              {
                label: t("result.blank"),
                value: report.written.blankCells,
                hint: report.written.enrolled ? t("result.enrolled", { count: report.written.enrolled }) : undefined,
              },
            ]}
          />
        </div>
      )}
    </Dialog>
  );
}

function UploadStep({ fileName, parsed, onFile }: { fileName: string | null; parsed: ParsedCanvasGradebook | null; onFile: (f: File) => void }) {
  const t = useTranslations("importer");
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-4">
      {/* Drop target with a button alternative, so dragging is never required (WCAG 2.5.7). */}
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
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-(--dur-1)",
          drag ? "border-brand bg-brand-soft" : "border-border-strong",
        )}
      >
        <FileUp className="mb-2 size-8 text-muted" aria-hidden />
        <p className="text-sm font-medium">{t("dropTitle")}</p>
        <p className="mb-3 text-xs text-muted">{t("dropHint")}</p>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          {t("chooseFile")}
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
          <Notice tone="ok">{t("detected", { file: fileName ?? "", columns: parsed.assignments.length, students: parsed.students.length })}</Notice>
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
  const t = useTranslations("importer");
  const tw = useTranslations("weights");
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // The panel is fixed-positioned (the table scrolls), so close it when anything scrolls.
    const onScroll = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
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
    // Re-split evenly on every change so the common case needs no typing.
    onChange(splitEvenly(selected.has(id) ? value.filter((v) => v.plo !== id).map((v) => v.plo) : [...value.map((v) => v.plo), id]));
  }

  const sorted = [...value].sort((a, b) => (byId.get(a.plo)?.number ?? 0) - (byId.get(b.plo)?.number ?? 0));

  return (
    <div className="space-y-1.5">
      <div ref={ref} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border-input bg-surface px-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-brand"
          aria-expanded={open}
        >
          <span className={cn("truncate", !value.length && "text-muted")}>{value.length ? sorted.map((v) => byId.get(v.plo)?.code).join(", ") : t("selectPlos")}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
        {open && (
          <fieldset style={pos} className="fixed z-50 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-e3">
            <legend className="sr-only">{t("selectPlos")}</legend>
            {plos.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2" title={p.description}>
                <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                <span>
                  <span className="font-medium">{p.code}</span> <span className="text-xs text-muted">{p.shortLabel}</span>
                  {highlight.includes(p.number) && (
                    <Badge tone="info" className="ml-1">
                      {tw("coursePlo")}
                    </Badge>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((v) => (
            <span key={v.plo} className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs">
              {byId.get(v.plo)?.code}
              <input
                type="text"
                inputMode="decimal"
                aria-label={tw("weightFor", { plo: byId.get(v.plo)?.code ?? "" })}
                value={Number.isFinite(v.weight) ? v.weight : ""}
                onChange={(e) => {
                  const n = parseScore(e.target.value);
                  onChange(value.map((w) => (w.plo === v.plo ? { ...w, weight: n === null ? NaN : n } : w)));
                }}
                className="h-6 w-14 rounded border border-border-input bg-surface px-1 text-right tabular"
              />
              %
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
