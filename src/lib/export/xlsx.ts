import { downloadBlob, type ExportColumn } from "./csv";

export interface Sheet<T> {
  name: string;
  rows: T[];
  columns: ExportColumn<T>[];
}

/**
 * Writes an .xlsx workbook with a frozen, bold header row and per-column number formats.
 * exceljs (~1 MB) is imported only when the user actually exports.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function downloadXlsx(filename: string, sheets: Sheet<any>[]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const sheet of sheets) {
    // Excel sheet names: max 31 chars, no []:*?/\
    const ws = wb.addWorksheet(sheet.name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      width: c.width ?? Math.min(40, Math.max(10, c.header.length + 2)),
      style: c.numFmt ? { numFmt: c.numFmt } : undefined,
    }));
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) ws.addRow(sheet.columns.map((c) => c.value(row) ?? null));
  }
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(filename, new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
