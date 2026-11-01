export type Cell = string | number | null | undefined;

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => Cell;
  /** Excel number format, e.g. "0.0" or "0.0\"%\"" (XLSX only). */
  numFmt?: string;
  width?: number;
}

/**
 * Text that a spreadsheet would run as a formula (CSV/formula injection, OWASP). Student names and
 * assessment titles are user-entered, so prefix them with an apostrophe, which Excel hides.
 */
function neutralizeFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function escapeCsv(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  const s = neutralizeFormula(cell);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a UTF-8 byte-order mark (so Excel opens Indonesian names correctly). */
export function toCsv<T>(rows: T[], columns: ExportColumn<T>[], { bom = true }: { bom?: boolean } = {}): string {
  const lines = [columns.map((c) => escapeCsv(c.header)), ...rows.map((r) => columns.map((c) => escapeCsv(c.value(r))))];
  return (bom ? "﻿" : "") + lines.map((l) => l.join(",")).join("\r\n") + "\r\n";
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv<T>(filename: string, rows: T[], columns: ExportColumn<T>[]) {
  downloadBlob(filename, new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" }));
}

/** "COMP3311 · Software Engineering", "2025/2026 · Odd" → "COMP3311-Software-Engineering-2025-2026-Odd" */
export function safeFilename(...parts: string[]): string {
  return parts
    .join(" ")
    .replace(/\//g, "-")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
