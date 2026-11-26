import "server-only";
import type { ClientSession } from "mongoose";
import { Assessment, Enrollment, Grade, User, CourseOffering, Types } from "@/models";
import { recomputeOffering } from "@/lib/obe/recompute";
import { HttpError } from "@/lib/auth/rbac";
import type { CanvasImportPayload } from "@/lib/validators";
import { diffFields, diffGrades, type AssessmentSnapshot, type AuditInput, type GradeWrite } from "@/lib/audit/diff";
import { newBatchId, recordAudit } from "@/lib/audit/record";
import { runInTransaction } from "@/lib/transaction";
import { normalizeLogin } from "./parse";
import { mergeRowsByUser } from "./merge";
import { assertPlosAssignedToCourse } from "@/lib/obe/plo-scope";
import { MAX_SCORE_FACTOR } from "@/lib/gradebook/parse-score";

export interface StudentMatch {
  name: string;
  sisLoginId: string;
  sisUserId: string;
  userId: string | null;
  userName: string | null;
  matchedBy: "email" | "studentId" | null;
  enrolled: boolean;
}

export interface ImportReport {
  matches: StudentMatch[];
  summary: { matched: number; unenrolled: number; unmatched: number };
  /**
   * `changes`: for an existing assessment, which of its stored settings this import would replace
   * (a re-import can undo a faculty head's PLO-weight correction, so the dry run says so).
   */
  assessments: { key: string; title: string; action: "create" | "update"; changes: ("ploWeights" | "gradeWeight" | "maxPoints")[] }[];
  /** Things the lecturer should look at before confirming. */
  checks: {
    /** Cells marked EX in Canvas whose student already has a grade here (kept unless clearExcused). */
    excusedWithGrade: number;
    /** Scores above the max points but within the bonus cap (extra credit, or a wrong scale). */
    aboveMax: number;
  };
  written?: { assessmentsCreated: number; assessmentsUpdated: number; gradesWritten: number; gradesCleared: number; enrolled: number; blankCells: number };
}

/** Matches Canvas rows to users: SIS Login ID → email first, then SIS User ID → student ID (NIM). */
export async function matchStudents(offeringId: string, rows: CanvasImportPayload["students"]): Promise<StudentMatch[]> {
  const emails = rows.map((r) => normalizeLogin(r.sisLoginId)).filter(Boolean);
  const nims = rows.map((r) => r.sisUserId.trim()).filter(Boolean);
  const users = await User.find({ roles: "student", $or: [{ email: { $in: emails } }, { studentId: { $in: nims } }] })
    .select("email studentId name")
    .lean();
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const byNim = new Map(users.filter((u) => u.studentId).map((u) => [u.studentId!, u]));
  const enrolled = new Set(
    (await Enrollment.find({ offering: offeringId }).select("student").lean()).map((e) => String(e.student)),
  );

  return rows.map((r) => {
    const email = normalizeLogin(r.sisLoginId);
    const viaEmail = email ? byEmail.get(email) : undefined;
    const viaNim = !viaEmail && r.sisUserId ? byNim.get(r.sisUserId.trim()) : undefined;
    const user = viaEmail ?? viaNim;
    return {
      name: r.name,
      sisLoginId: r.sisLoginId,
      sisUserId: r.sisUserId,
      userId: user ? String(user._id) : null,
      userName: user?.name ?? null,
      matchedBy: viaEmail ? "email" : viaNim ? "studentId" : null,
      enrolled: user ? enrolled.has(String(user._id)) : false,
    };
  });
}

/** Titles match ignoring upper/lower case, like the import wizard's preview ("Midterm exam" = "Midterm Exam"). */
const TITLE_COLLATION = { locale: "en", strength: 2 } as const;

async function findExistingAssessment(offeringId: string, a: CanvasImportPayload["assessments"][number], session?: ClientSession) {
  const opts = session ? { session } : {};
  if (a.canvasId) {
    const byCanvasId = await Assessment.findOne({ offering: offeringId, canvasId: a.canvasId }, null, opts);
    if (byCanvasId) return byCanvasId;
    // A column the lecturer already created by hand (no Canvas ID yet) is adopted, not duplicated.
    return Assessment.findOne({ offering: offeringId, title: a.title, canvasId: { $not: { $type: "string" } } }, null, opts).collation(TITLE_COLLATION);
  }
  return Assessment.findOne({ offering: offeringId, title: a.title }, null, opts).collation(TITLE_COLLATION);
}

export async function runCanvasImport(
  offeringId: string,
  payload: CanvasImportPayload,
  actor: { id: string; name: string },
): Promise<ImportReport> {
  const offering = await CourseOffering.findById(offeringId).lean();
  if (!offering) throw new HttpError(404, "Class not found");

  // PLOs must be ones the admin assigned to this course.
  const ploIds = [...new Set(payload.assessments.flatMap((a) => a.ploWeights.map((w) => w.plo)))];
  await assertPlosAssignedToCourse(offering.course, ploIds);
  for (const a of payload.assessments) {
    if (!a.ploWeights.length) throw new HttpError(400, `"${a.title}" is not mapped to any PLO`);
    const total = a.ploWeights.reduce((s, w) => s + w.weight, 0);
    if (Math.abs(total - 100) > 0.01) throw new HttpError(400, `PLO weights of "${a.title}" must total 100% (got ${total}%)`);
  }

  // Scores far above max points are almost always a wrong scale or a typo: stop before anything is written.
  const maxByKey = new Map(payload.assessments.map((a) => [a.key, a.maxPoints]));
  const tooHigh: string[] = [];
  for (const row of payload.students) {
    for (const [key, score] of Object.entries(row.scores)) {
      const max = maxByKey.get(key);
      if (max !== undefined && score !== null && score > max * MAX_SCORE_FACTOR) tooHigh.push(`${row.name} – ${key}: ${score}/${max}`);
    }
  }
  if (tooHigh.length) {
    throw new HttpError(400, `${tooHigh.length} score(s) are far above the max points, e.g. ${tooHigh.slice(0, 3).join("; ")}`);
  }

  const matches = await matchStudents(offeringId, payload.students);
  // A student in two sections is on two rows: write and enroll them once, and stop if the rows disagree.
  const { merged, conflicts } = mergeRowsByUser(payload.students, matches.map((m) => m.userId));
  if (conflicts.length) {
    const examples = conflicts.slice(0, 3).map((c) => `${c.name} – ${c.key}: ${c.values.join(" vs ")}`);
    throw new HttpError(400, `${conflicts.length} cell(s) have different scores for the same student on different rows, e.g. ${examples.join("; ")}`);
  }
  const enrolledByUser = new Map(matches.filter((m) => m.userId).map((m) => [m.userId!, m.enrolled]));
  const summary = {
    matched: merged.filter((r) => enrolledByUser.get(r.userId)).length,
    unenrolled: merged.filter((r) => !enrolledByUser.get(r.userId)).length,
    unmatched: matches.filter((m) => !m.userId).length,
  };
  const importableRows = merged.filter((r) => enrolledByUser.get(r.userId) || payload.enrollUnenrolled);
  const snap = (x: { title: string; maxPoints: number; gradeWeight?: number; ploWeights: { plo: unknown; weight: number }[] }): AssessmentSnapshot => ({
    title: x.title,
    maxPoints: x.maxPoints,
    gradeWeight: x.gradeWeight ?? 0,
    // Sorted, so the same mapping in another order is not reported as a change.
    ploWeights: x.ploWeights.map((w) => ({ plo: String(w.plo), weight: w.weight })).sort((p, q) => p.plo.localeCompare(q.plo)),
  });

  const existingByKey = new Map<string, Awaited<ReturnType<typeof findExistingAssessment>>>();
  const assessmentsPreview: ImportReport["assessments"] = [];
  for (const a of payload.assessments) {
    const existing = await findExistingAssessment(offeringId, a);
    existingByKey.set(a.key, existing);
    const changes: ImportReport["assessments"][number]["changes"] = [];
    if (existing) {
      const diff = diffFields(snap(existing), snap(a));
      for (const f of ["ploWeights", "gradeWeight", "maxPoints"] as const) if (diff && f in diff.after) changes.push(f);
    }
    assessmentsPreview.push({ key: a.key, title: a.title, action: existing ? "update" : "create", changes });
  }

  // Dry-run checks: excused cells that would leave an old grade in place, and scores above max.
  const existingIds = [...existingByKey.values()].filter(Boolean).map((e) => e!._id);
  const storedGrades = existingIds.length
    ? await Grade.find({ offering: offering._id, assessment: { $in: existingIds } }, "assessment student").lean()
    : [];
  const graded = new Set(storedGrades.map((g) => `${g.student}:${g.assessment}`));
  const checks: ImportReport["checks"] = { excusedWithGrade: 0, aboveMax: 0 };
  for (const row of importableRows) {
    for (const a of payload.assessments) {
      const score = row.scores[a.key];
      if (score !== null && score !== undefined && score > a.maxPoints) checks.aboveMax++;
      const existing = existingByKey.get(a.key);
      if (existing && row.excused.includes(a.key) && graded.has(`${row.userId}:${existing._id}`)) checks.excusedWithGrade++;
    }
  }
  if (payload.dryRun) return { matches, summary, assessments: assessmentsPreview, checks };

  const write = async (session?: ClientSession) => {
    const opts = session ? { session } : {};
    const written = { assessmentsCreated: 0, assessmentsUpdated: 0, gradesWritten: 0, gradesCleared: 0, enrolled: 0, blankCells: 0 };

    const assessmentIdByKey = new Map<string, Types.ObjectId>();
    const assessmentAudit: AuditInput[] = [];
    for (const a of payload.assessments) {
      const fields = {
        title: a.title,
        maxPoints: a.maxPoints,
        gradeWeight: a.gradeWeight,
        ploWeights: a.ploWeights.map((w) => ({ plo: new Types.ObjectId(w.plo), weight: w.weight })),
        source: "canvas" as const,
        ...(a.canvasId ? { canvasId: a.canvasId } : {}),
      };
      const existing = await findExistingAssessment(offeringId, a, session);
      if (existing) {
        // Re-imports can change weights a faculty head corrected: make that visible in the history.
        const changed = diffFields(snap(existing), snap(a));
        if (changed) assessmentAudit.push({ action: "assessment.update", assessment: String(existing._id), assessmentTitle: a.title, ...changed });
        existing.set(fields);
        await existing.save(opts);
        assessmentIdByKey.set(a.key, existing._id);
        written.assessmentsUpdated++;
      } else {
        const [created] = await Assessment.create([{ offering: offering._id, ...fields }], opts);
        assessmentIdByKey.set(a.key, created._id);
        assessmentAudit.push({ action: "assessment.create", assessment: String(created._id), assessmentTitle: a.title, after: snap(a) });
        written.assessmentsCreated++;
      }
    }

    const toEnroll = payload.enrollUnenrolled ? merged.filter((r) => !enrolledByUser.get(r.userId)) : [];
    if (toEnroll.length) {
      await Enrollment.insertMany(toEnroll.map((r) => ({ offering: offering._id, student: r.userId })), opts);
      written.enrolled = toEnroll.length;
    }

    const writes: GradeWrite[] = [];
    for (const row of importableRows) {
      for (const a of payload.assessments) {
        const assessment = String(assessmentIdByKey.get(a.key)!);
        const score = row.scores[a.key];
        if (score !== null && score !== undefined) {
          writes.push({ assessment, student: row.userId, score });
        } else if (payload.clearExcused && row.excused.includes(a.key)) {
          // Confirmed in the dry run: an excused assessment no longer counts for this student.
          writes.push({ assessment, student: row.userId, score: null });
        } else {
          written.blankCells++; // blank, "-" and (unless confirmed) EX cells never overwrite a grade
        }
      }
    }

    // Write and audit only cells whose value actually changes.
    const stored = await Grade.find({ offering: offering._id }, "assessment student score", opts).lean();
    const current = new Map(stored.map((g) => [`${g.student}:${g.assessment}`, g.score]));
    const titleByKeyId = new Map(payload.assessments.map((a) => [String(assessmentIdByKey.get(a.key)), a.title]));
    const changes = diffGrades(current, writes, (aid) => titleByKeyId.get(aid));
    const ops = changes.map((c) => {
      const filter = { assessment: new Types.ObjectId(c.assessment), student: new Types.ObjectId(c.student) };
      return c.action === "grade.clear"
        ? { deleteOne: { filter } }
        : { updateOne: { filter, update: { $set: { score: c.after as number, offering: offering._id } }, upsert: true } };
    });
    if (ops.length) await Grade.bulkWrite(ops, opts);
    written.gradesCleared = changes.filter((c) => c.action === "grade.clear").length;
    written.gradesWritten = ops.length - written.gradesCleared;

    const summaryEntry: AuditInput = { action: "canvas.import", after: { ...written, assessments: payload.assessments.map((a) => a.title) } };
    await recordAudit([summaryEntry, ...assessmentAudit, ...changes], { offering: offering._id, actor, source: "canvas", batch: newBatchId() }, session);

    await recomputeOffering(offering._id, session);
    return written;
  };

  const { result: written } = await runInTransaction(write);
  return { matches, summary, assessments: assessmentsPreview, checks, written };
}
