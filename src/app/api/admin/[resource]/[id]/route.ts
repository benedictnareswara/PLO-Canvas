import { NextResponse } from "next/server";
import { apiHandler, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { getResource } from "@/lib/admin/resources";
import { objectId } from "@/lib/validators";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const user = await requireApiUser("superadmin");
  const { resource, id } = await params;
  objectId.parse(id);
  const config = getResource(resource);
  let data = config.update.parse(await req.json()) as Record<string, unknown>;
  if (config.transform) data = await config.transform(data, "update");
  if (resource === "users" && id === user.id && Array.isArray(data.roles) && !data.roles.includes("superadmin")) {
    throw new HttpError(400, "You cannot remove your own superadmin role");
  }
  const res = await config.model.updateOne({ _id: id }, data, { runValidators: true });
  if (!res.matchedCount) throw new HttpError(404, "Not found");
  await config.afterWrite?.(id);
  return NextResponse.json({ ok: true });
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser("superadmin");
  const { resource, id } = await params;
  objectId.parse(id);
  if (resource === "users" && id === user.id) throw new HttpError(400, "You cannot delete your own account");
  const config = getResource(resource);
  await config.beforeDelete?.(id);
  const res = await config.model.deleteOne({ _id: id });
  if (!res.deletedCount) throw new HttpError(404, "Not found");
  return NextResponse.json({ ok: true });
});
