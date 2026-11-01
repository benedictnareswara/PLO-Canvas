"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { Tabs } from "@/components/ui/client";
import { ExportMenu } from "@/components/ExportMenu";
import type { OfferingDetail } from "@/lib/obe/queries";
import { CanvasImportWizard } from "./CanvasImportWizard";
import { exportAttainmentCsv, exportGradesCsv, exportWorkbook } from "./export";
import { useExportLabels } from "./useExportLabels";
import { AssessmentsTab } from "./tabs/AssessmentsTab";
import { GradebookTab } from "./tabs/GradebookTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { RadarTab } from "./tabs/RadarTab";
import { SettingsTab } from "./tabs/SettingsTab";

export function OfferingWorkspace({ detail, canEdit }: { detail: OfferingDetail; canEdit: boolean }) {
  const t = useTranslations("offering.tabs");
  return (
    <Tabs
      sticky
      label={t("label")}
      tabs={[
        { key: "radar", label: t("radar"), content: <RadarTab detail={detail} canEdit={canEdit} /> },
        { key: "gradebook", label: t("gradebook"), content: <GradebookTab detail={detail} canEdit={canEdit} /> },
        {
          key: "assessments",
          label: (
            <>
              {t("assessments")} <span className="ml-1 text-xs text-muted tabular">{detail.assessments.length}</span>
            </>
          ),
          content: <AssessmentsTab detail={detail} canEdit={canEdit} />,
        },
        { key: "history", label: t("history"), content: <HistoryTab detail={detail} /> },
        ...(canEdit ? [{ key: "settings", label: t("settings"), content: <SettingsTab detail={detail} /> }] : []),
      ]}
    />
  );
}

/** Page-header actions: Canvas import (primary) and exports. */
export function OfferingActions({ detail, canEdit }: { detail: OfferingDetail; canEdit: boolean }) {
  const t = useTranslations("offering");
  const labels = useExportLabels();
  const [importOpen, setImportOpen] = useState(false);
  return (
    <>
      <ExportMenu
        items={[
          { key: "grades", label: t("exportGrades"), format: "csv", run: () => exportGradesCsv(detail, labels) },
          { key: "attainment", label: t("exportAttainment"), format: "csv", run: () => exportAttainmentCsv(detail, labels) },
          { key: "xlsx", label: t("exportWorkbook"), format: "xlsx", run: () => exportWorkbook(detail, labels) },
        ]}
      />
      {canEdit && (
        <>
          <Button onClick={() => setImportOpen(true)}>
            <Upload aria-hidden /> {t("import")}
          </Button>
          <CanvasImportWizard open={importOpen} onClose={() => setImportOpen(false)} detail={detail} />
        </>
      )}
    </>
  );
}
