"use client";

import { useTranslations } from "next-intl";
import type { ExportLabels } from "./export";

/** Column and sheet names for class exports, in the current UI language. */
export function useExportLabels(): ExportLabels {
  const t = useTranslations("export");
  return {
    nim: t("nim"),
    name: t("name"),
    email: t("email"),
    courseGrade: t("courseGrade"),
    letter: t("letter"),
    scores: t("scores"),
    percent: t("percent"),
    attainment: t("attainment"),
  };
}
