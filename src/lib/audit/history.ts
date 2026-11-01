import type { AuditAction } from "@/models";

/** One row of a class's change history, as returned by GET /api/offerings/[id]/history. */
export interface HistoryEntry {
  id: string;
  createdAt: string;
  actorName: string;
  action: AuditAction;
  source: "manual" | "canvas";
  batch: string;
  student: { id: string; name: string; studentId: string | null } | null;
  assessment: { id: string; title: string } | null;
  before: unknown;
  after: unknown;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  nextCursor: string | null;
}

export type BatchKind = "grades" | "import" | "assessmentCreate" | "assessmentUpdate" | "assessmentDelete" | "threshold";

export interface HistoryBatch {
  batch: string;
  kind: BatchKind;
  actorName: string;
  source: "manual" | "canvas";
  /** Time of the newest entry in the batch. */
  createdAt: string;
  entries: HistoryEntry[];
  /** Grade cells set / cleared in this batch. */
  set: number;
  cleared: number;
}

const KIND_OF: Record<AuditAction, BatchKind> = {
  "grade.set": "grades",
  "grade.clear": "grades",
  "canvas.import": "import",
  "assessment.create": "assessmentCreate",
  "assessment.update": "assessmentUpdate",
  "assessment.delete": "assessmentDelete",
  "threshold.update": "threshold",
};

/**
 * Groups newest-first entries into one row per save or import. Entries of a batch are written
 * together, so they're adjacent; an import's summary entry decides the batch kind.
 */
export function groupHistory(entries: HistoryEntry[]): HistoryBatch[] {
  const out: HistoryBatch[] = [];
  for (const e of entries) {
    let group = out[out.length - 1];
    if (!group || group.batch !== e.batch) {
      group = { batch: e.batch, kind: KIND_OF[e.action], actorName: e.actorName, source: e.source, createdAt: e.createdAt, entries: [], set: 0, cleared: 0 };
      out.push(group);
    }
    if (e.action === "canvas.import") group.kind = "import";
    if (e.action === "grade.set") group.set++;
    if (e.action === "grade.clear") group.cleared++;
    group.entries.push(e);
  }
  return out;
}
