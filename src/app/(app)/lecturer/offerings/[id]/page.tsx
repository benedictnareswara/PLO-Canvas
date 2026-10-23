import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canAccessOffering, requirePageUser } from "@/lib/auth/rbac";
import { getOfferingDetail } from "@/lib/obe/queries";
import { Badge, PageHeader } from "@/components/ui";
import { OfferingWorkspace } from "@/components/offering/OfferingWorkspace";

export const metadata: Metadata = { title: "Class" };

export default async function OfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const user = await requirePageUser("lecturer", "faculty_head");
  if (!(await canAccessOffering(user, id, "read"))) notFound();
  const detail = await getOfferingDetail(id);
  if (!detail) notFound();
  const canEdit = await canAccessOffering(user, id, "write");

  return (
    <>
      <Link href="/lecturer" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> My Classes
      </Link>
      <PageHeader
        title={`${detail.code} · ${detail.title}`}
        description={
          <>
            {detail.period} · {detail.sks} SKS · {detail.lecturers.map((l) => l.name).join(", ")} · target {detail.threshold}%
            {!canEdit && (
              <Badge className="ml-2" tone="info">
                Read-only
              </Badge>
            )}
          </>
        }
      />
      <OfferingWorkspace detail={detail} canEdit={canEdit} initialTab={tab} />
    </>
  );
}
