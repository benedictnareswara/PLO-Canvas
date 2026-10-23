import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { Assessment, Enrollment, Grade, Plo, User, CourseOffering, Course, Types } from "@/models";
import { recomputeOffering } from "@/lib/obe/recompute";
import { HttpError } from "@/lib/auth/rbac";
import type { CanvasImportPayload } from "@/lib/validators";
import { normalizeLogin } from "./parse";

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
  assessments: { key: string; title: string; action: "create" | "update" }[];
  written?: { assessmentsCreated: number; assessmentsUpdated: number; gradesWritten: number; enrolled: number; blankCells: number };
  transactional?: boolean;
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

async function findExistingAssessment(offeringId: string, a: CanvasImportPayload["assessments"][number], session?: ClientSession) {
  const filter = a.canvasId ? { offering: offeringId, canvasId: a.canvasId } : { offering: offeringId, title: a.title };
  return Assessment.findOne(filter, null, session ? { session } : {});
}

export async function runCanvasImport(offeringId: string, payload: CanvasImportPayload): Promise<ImportReport> {
  const offering = await CourseOffering.findById(offeringId).lean();
  if (!offering) throw new HttpError(404, "Class not found");
  const course = await Course.findById(offering.course).lean();

  // PLOs must belong to the offering's curriculum.
  const ploIds = [...new Set(payload.assessments.flatMap((a) => a.ploWeights.map((w) => w.plo)))];
  const validPlos = await Plo.countDocuments({ _id: { $in: ploIds }, curriculum: course?.curriculum });
  if (validPlos !== ploIds.length) throw new HttpError(400, "One or more PLOs do not belong to this course's curriculum");
  for (const a of payload.assessments) {
    if (!a.ploWeights.length) throw new HttpError(400, `"${a.title}" is not mapped to any PLO`);
    const total = a.ploWeights.reduce((s, w) => s + w.weight, 0);
    if (Math.abs(total - 100) > 0.01) throw new HttpError(400, `PLO weights of "${a.title}" must total 100% (got ${total}%)`);
  }

  const matches = await matchStudents(offeringId, payload.students);
  const summary = {
    matched: matches.filter((m) => m.userId && m.enrolled).length,
    unenrolled: matches.filter((m) => m.userId && !m.enrolled).length,
    unmatched: matches.filter((m) => !m.userId).length,
  };
  const assessmentsPreview: ImportReport["assessments"] = [];
  for (const a of payload.assessments) {
    assessmentsPreview.push({ key: a.key, title: a.title, action: (await findExistingAssessment(offeringId, a)) ? "update" : "create" });
  }
  if (payload.dryRun) return { matches, summary, assessments: assessmentsPreview };

  const write = async (session?: ClientSession) => {
    const opts = session ? { session } : {};
    const written = { assessmentsCreated: 0, assessmentsUpdated: 0, gradesWritten: 0, enrolled: 0, blankCells: 0 };

    const assessmentIdByKey = new Map<string, Types.ObjectId>();
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
        existing.set(fields);
        await existing.save(opts);
        assessmentIdByKey.set(a.key, existing._id);
        written.assessmentsUpdated++;
      } else {
        const [created] = await Assessment.create([{ offering: offering._id, ...fields }], opts);
        assessmentIdByKey.set(a.key, created._id);
        written.assessmentsCreated++;
      }
    }

    const toEnroll = payload.enrollUnenrolled ? matches.filter((m) => m.userId && !m.enrolled) : [];
    if (toEnroll.length) {
      await Enrollment.insertMany(toEnroll.map((m) => ({ offering: offering._id, student: m.userId })), opts);
      written.enrolled = toEnroll.length;
    }

    const ops: Parameters<typeof Grade.bulkWrite>[0] = [];
    payload.students.forEach((row, i) => {
      const m = matches[i];
      if (!m.userId || (!m.enrolled && !payload.enrollUnenrolled)) return;
      for (const a of payload.assessments) {
        const score = row.scores[a.key];
        if (score === null || score === undefined) {
          written.blankCells++; // blank / excused cells never overwrite existing grades
          continue;
        }
        const assessment = assessmentIdByKey.get(a.key)!;
        ops.push({
          updateOne: {
            filter: { assessment, student: new Types.ObjectId(m.userId) },
            update: { $set: { score, offering: offering._id } },
            upsert: true,
          },
        });
      }
    });
    if (ops.length) await Grade.bulkWrite(ops, opts);
    written.gradesWritten = ops.length;

    await recomputeOffering(offering._id, session);
    return written;
  };

  const session = await mongoose.startSession();
  try {
    let written: ImportReport["written"];
    await session.withTransaction(async () => {
      written = await write(session);
    });
    return { matches, summary, assessments: assessmentsPreview, written, transactional: true };
  } catch (err) {
    // Standalone MongoDB (no replica set) cannot run transactions; fall back to sequential writes.
    const msg = (err as Error).message ?? "";
    if (/replica set|Transaction numbers/i.test(msg)) {
      return { matches, summary, assessments: assessmentsPreview, written: await write(), transactional: false };
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
