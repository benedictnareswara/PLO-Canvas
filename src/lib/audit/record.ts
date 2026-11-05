import "server-only";
import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { AuditEvent, Types } from "@/models";
import type { AuditInput } from "./diff";

export interface AuditContext {
  offering: string | Types.ObjectId;
  actor: { id: string; name: string };
  source?: "manual" | "canvas";
  /** Shared by every entry of one save or import; generated when omitted. */
  batch?: string;
}

export function newBatchId(): string {
  return randomUUID();
}

/** Writes audit entries; pass the change's session so they commit (or roll back) with it. */
export async function recordAudit(entries: AuditInput[], ctx: AuditContext, session?: ClientSession) {
  if (!entries.length) return;
  const batch = ctx.batch ?? newBatchId();
  const oid = (id?: string) => (id ? new Types.ObjectId(id) : undefined);
  await AuditEvent.insertMany(
    entries.map((e) => ({
      offering: new Types.ObjectId(String(ctx.offering)),
      actor: new Types.ObjectId(ctx.actor.id),
      actorName: ctx.actor.name,
      source: ctx.source ?? "manual",
      batch,
      action: e.action,
      student: oid(e.student),
      assessment: oid(e.assessment),
      assessmentTitle: e.assessmentTitle,
      before: e.before,
      after: e.after,
    })),
    session ? { session } : {},
  );
}
