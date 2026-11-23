import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canAccessOffering, getCurrentUser, requirePageUser } from "@/lib/auth/rbac";
import { getOfferingDetail } from "@/lib/obe/queries";
import { Badge, Breadcrumbs, PageHeader } from "@/components/ui";
import { OfferingActions, OfferingWorkspace } from "@/components/offering/OfferingWorkspace";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !(await canAccessOffering(user, id, "read"))) return {};
  const detail = await getOfferingDetail(id);
  return detail ? { title: `${detail.code} · ${detail.title}` } : {};
}

export default async function OfferingPage({ params }: Props) {
  const { id } = await params;
  const user = await requirePageUser("lecturer", "faculty_head");
  if (!(await canAccessOffering(user, id, "read"))) notFound();
  const [detail, canEdit, canEditMapping, t] = await Promise.all([
    getOfferingDetail(id),
    canAccessOffering(user, id, "write"),
    // FR-26 / UC-08: a faculty head reviewing a department class may correct its PLO weights.
    canAccessOffering(user, id, "mapping"),
    getTranslations(),
  ]);
  if (!detail) notFound();

  return (
    <>
      <Breadcrumbs label={t("shell.breadcrumb")} items={[{ href: "/lecturer", label: t("nav.myClasses") }, { label: detail.code }]} />
      <PageHeader
        title={`${detail.code} · ${detail.title}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{detail.period}</span>
            <span aria-hidden>·</span>
            <span>{t("offering.sks", { sks: detail.sks })}</span>
            <span aria-hidden>·</span>
            <span>{detail.lecturers.map((l) => l.name).join(", ")}</span>
            <span aria-hidden>·</span>
            <span>{t("offering.target", { value: detail.threshold })}</span>
            {!canEdit && <Badge tone="info">{canEditMapping ? t("offering.mappingReview") : t("offering.readOnly")}</Badge>}
          </span>
        }
        actions={<OfferingActions detail={detail} canEdit={canEdit} />}
      />
      <OfferingWorkspace detail={detail} canEdit={canEdit} canEditMapping={canEditMapping} />
    </>
  );
}
