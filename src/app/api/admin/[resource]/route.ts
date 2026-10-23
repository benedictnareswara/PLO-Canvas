import { NextResponse } from "next/server";
import { apiHandler, requireApiUser } from "@/lib/auth/rbac";
import { getResource } from "@/lib/admin/resources";

type Ctx = { params: Promise<{ resource: string }> };

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  await requireApiUser("superadmin");
  const { model } = getResource((await params).resource);
  return NextResponse.json(await model.find().sort({ createdAt: 1 }).lean());
});

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  await requireApiUser("superadmin");
  const config = getResource((await params).resource);
  let data = config.create.parse(await req.json()) as Record<string, unknown>;
  if (config.transform) data = await config.transform(data, "create");
  const doc = await config.model.create(data);
  await config.afterWrite?.(String(doc._id));
  return NextResponse.json({ id: String(doc._id) }, { status: 201 });
});
