import { describe, expect, it } from "vitest";
import { safeFilename, toCsv, type ExportColumn } from "@/lib/export/csv";

type Row = { name: string; score: number | null };
const columns: ExportColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Score", value: (r) => r.score },
];

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF", () => {
    const csv = toCsv([{ name: "Andi", score: 85.5 }], columns);
    expect(csv.startsWith("﻿Name,Score\r\n")).toBe(true);
    expect(csv.endsWith("Andi,85.5\r\n")).toBe(true);
  });

  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    const csv = toCsv([{ name: 'Wijaya, "Andi"\nJr', score: null }], columns, { bom: false });
    expect(csv.split("\r\n")[1]).toBe('"Wijaya, ""Andi""\nJr",');
  });

  it("keeps Indonesian characters intact", () => {
    expect(toCsv([{ name: "Ni Luh Putu Ayu Ṣ", score: 1 }], columns)).toContain("Ni Luh Putu Ayu Ṣ");
  });

  it("neutralises text that a spreadsheet would run as a formula", () => {
    const csv = toCsv([{ name: "=HYPERLINK(\"x\")", score: -5 }], columns, { bom: false });
    expect(csv.split("\r\n")[1]).toBe(`"'=HYPERLINK(""x"")",-5`);
  });

  it("writes numbers as numbers and blanks as empty", () => {
    expect(toCsv([{ name: "A", score: null }], columns, { bom: false }).split("\r\n")[1]).toBe("A,");
  });
});

describe("safeFilename", () => {
  it("strips punctuation and joins words", () => {
    expect(safeFilename("COMP3311 · Software Engineering", "2025/2026 · Odd")).toBe("COMP3311-Software-Engineering-2025-2026-Odd");
  });
});
