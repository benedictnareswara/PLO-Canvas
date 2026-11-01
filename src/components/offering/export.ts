"use client";

import { downloadCsv, safeFilename, type ExportColumn } from "@/lib/export/csv";
import { scorePercentage } from "@/lib/obe/engine";
import type { OfferingDetail } from "@/lib/obe/queries";
import type { StudentSummary } from "@/lib/obe/types";

export interface ExportLabels {
  nim: string;
  name: string;
  email: string;
  courseGrade: string;
  letter: string;
  scores: string;
  percent: string;
  attainment: string;
}

function baseColumns(labels: ExportLabels): ExportColumn<StudentSummary>[] {
  return [
    { header: labels.nim, value: (s) => s.studentId, width: 14 },
    { header: labels.name, value: (s) => s.name, width: 28 },
    { header: labels.email, value: (s) => s.email, width: 30 },
  ];
}

function gradeColumns(detail: OfferingDetail, labels: ExportLabels): ExportColumn<StudentSummary>[] {
  return [
    { header: `${labels.courseGrade} (%)`, value: (s) => round(detail.courseGrades[s.id]?.pct), numFmt: "0.0" },
    { header: labels.letter, value: (s) => detail.courseGrades[s.id]?.letter ?? null, width: 8 },
  ];
}

function round(v: number | null | undefined) {
  return v === null || v === undefined ? null : Math.round(v * 10) / 10;
}

/** Raw scores per assessment plus the course grade: what the registry imports or archives. */
function scoreColumns(detail: OfferingDetail, labels: ExportLabels): ExportColumn<StudentSummary>[] {
  return [
    ...baseColumns(labels),
    ...detail.assessments.map(
      (a): ExportColumn<StudentSummary> => ({ header: `${a.title} (/${a.maxPoints})`, value: (s) => detail.grades[s.id]?.[a.id] ?? null }),
    ),
    ...gradeColumns(detail, labels),
  ];
}

function filename(detail: OfferingDetail, what: string, ext: string) {
  return `${safeFilename(detail.code, detail.period, what)}.${ext}`;
}

export function exportGradesCsv(detail: OfferingDetail, labels: ExportLabels) {
  downloadCsv(filename(detail, labels.scores, "csv"), detail.students, scoreColumns(detail, labels));
}

export function exportAttainmentCsv(detail: OfferingDetail, labels: ExportLabels) {
  downloadCsv(filename(detail, labels.attainment, "csv"), detail.students, attainmentColumns(detail, labels));
}

function attainmentColumns(detail: OfferingDetail, labels: ExportLabels): ExportColumn<StudentSummary>[] {
  return [
    ...baseColumns(labels),
    ...detail.plos
      .filter((p) => detail.students.some((s) => detail.attainment[s.id]?.[p.number] != null))
      .map((p): ExportColumn<StudentSummary> => ({ header: `${p.code} (%)`, value: (s) => round(detail.attainment[s.id]?.[p.number]), numFmt: "0.0" })),
    ...gradeColumns(detail, labels),
  ];
}

/** One workbook: raw scores, score percentages and course-level PLO attainment. */
export async function exportWorkbook(detail: OfferingDetail, labels: ExportLabels) {
  const { downloadXlsx } = await import("@/lib/export/xlsx");
  await downloadXlsx(filename(detail, labels.scores, "xlsx"), [
    { name: labels.scores, rows: detail.students, columns: scoreColumns(detail, labels) },
    {
      name: labels.percent,
      rows: detail.students,
      columns: [
        ...baseColumns(labels),
        ...detail.assessments.map(
          (a): ExportColumn<StudentSummary> => ({
            header: `${a.title} (%)`,
            value: (s) => {
              const score = detail.grades[s.id]?.[a.id];
              return score === undefined ? null : round(scorePercentage(score, a.maxPoints));
            },
            numFmt: "0.0",
          }),
        ),
        ...gradeColumns(detail, labels),
      ],
    },
    { name: labels.attainment, rows: detail.students, columns: attainmentColumns(detail, labels) },
  ]);
}
