import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, assertOfferingAccess, requireApiUser } from "@/lib/auth/rbac";
import { objectId } from "@/lib/validators";
import type { HistoryEntry } from "@/lib/audit/history";
import { AuditEvent, Types, User, type AuditAction } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS_OF_KIND: Record<string, AuditAction[]> = {
  grades: ["grade.set", "grade.clear"],
  assessments: ["assessment.create", "assessment.update", "assessment.delete"],
  target: ["threshold.update"],
  imports: ["canvas.import"],
};

const querySchema = z.object({
  cursor: z.string().optional(),
  student: objectId.optional(),
  assessment: objectId.optional(),
  kind: z.enum(["grades", "assessments", "target", "imports"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Opaque cursor: newest-first keyset on (createdAt, _id), stable while new events arrive. */
function encodeCursor(createdAt: Date, id: Types.ObjectId) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}
function decodeCursor(cursor: string): { createdAt: Date; id: Types.ObjectId } | null {
  const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) || !Types.ObjectId.isValid(id) ? null : { createdAt, id: new Types.ObjectId(id) };
}

/** Change history of one class, newest first. Anyone who can read the class can read it. */
export const GET = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "read");
  const q = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));

  const filter: Record<string, unknown> = { offering: new Types.ObjectId(id) };
  if (q.student) filter.student = new Types.ObjectId(q.student);
  if (q.assessment) filter.assessment = new Types.ObjectId(q.assessment);
  if (q.kind) filter.action = { $in: ACTIONS_OF_KIND[q.kind] };
  const cursor = q.cursor ? decodeCursor(q.cursor) : null;
  if (cursor) filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }];

  const events = await AuditEvent.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(q.limit + 1)
    .lean();
  const page = events.slice(0, q.limit);
  const students = await User.find({ _id: { $in: [...new Set(page.filter((e) => e.student).map((e) => String(e.student)))] } })
    .select("name studentId")
    .lean();
  const studentById = new Map(students.map((s) => [String(s._id), s]));

  const entries: HistoryEntry[] = page.map((e) => {
    const s = e.student ? studentById.get(String(e.student)) : undefined;
    return {
      id: String(e._id),
      createdAt: e.createdAt.toISOString(),
      actorName: e.actorName,
      action: e.action,
      source: e.source,
      batch: e.batch,
      student: e.student ? { id: String(e.student), name: s?.name ?? "—", studentId: s?.studentId ?? null } : null,
      assessment: e.assessment ? { id: String(e.assessment), title: e.assessmentTitle ?? "—" } : null,
      before: e.before ?? null,
      after: e.after ?? null,
    };
  });
  const last = page[page.length - 1];
  return NextResponse.json({
    entries,
    nextCursor: events.length > q.limit && last ? encodeCursor(last.createdAt, last._id as Types.ObjectId) : null,
  });
});
