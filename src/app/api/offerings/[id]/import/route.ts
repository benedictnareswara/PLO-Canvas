import { NextResponse } from "next/server";
import { apiHandler, assertOfferingAccess, requireApiUser } from "@/lib/auth/rbac";
import { canvasImportSchema } from "@/lib/validators";
import { runCanvasImport } from "@/lib/canvas/import";

type Ctx = { params: Promise<{ id: string }> };

/** Canvas CSV import. `dryRun: true` returns the student-matching report without writing. */
export const POST = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireApiUser();
  await assertOfferingAccess(user, id, "write");
  const payload = canvasImportSchema.parse(await req.json());
  return NextResponse.json(await runCanvasImport(id, payload));
});
