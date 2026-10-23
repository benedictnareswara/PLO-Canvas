import Papa from "papaparse";

/**
 * Parser for Canvas "Gradebook → Export → CSV" files. Pure: runs in the browser
 * (wizard preview) and on the server (re-validation before writing).
 *
 * Layout of a Canvas export:
 *   row 1  Student, ID, SIS User ID, SIS Login ID, Section, <Assignment (canvasId)>..., Current Score, ...
 *   row 2  "    Points Possible", , , , , 10.00, 100.00, ..., (read only), ...
 *   row 3+ one row per student (plus "Student, Test" for the test student)
 */

export interface CanvasAssignment {
  /** Exact header text, used as the key into each student's `scores`. */
  key: string;
  title: string;
  canvasId: string | null;
  maxPoints: number | null;
  gradedCount: number;
}

export interface CanvasStudentRow {
  name: string;
  canvasUserId: string;
  sisUserId: string;
  sisLoginId: string;
  section: string;
  scores: Record<string, number | null>;
}

export interface ParsedCanvasGradebook {
  assignments: CanvasAssignment[];
  students: CanvasStudentRow[];
  skippedColumns: string[];
  warnings: string[];
}

const IDENTITY_COLUMNS: Record<string, keyof Omit<CanvasStudentRow, "scores"> | null> = {
  student: "name",
  id: "canvasUserId",
  "sis user id": "sisUserId",
  "sis login id": "sisLoginId",
  "login id": "sisLoginId",
  section: "section",
  "integration id": null,
  "root account": null,
};

const ASSIGNMENT_HEADER = /^(.*\S)\s*\((\d+)\)\s*$/;
const COMPUTED_HEADER = /\b(current|final|unposted)\b.*\b(score|points|grade)\b/i;

const isTestStudent = (name: string) => /^(student,\s*test|test student)$/i.test(name.trim());

/** Parses one gradebook cell. Blank, "-", "EX" (excused) and unknown text → null (no grade). */
export function parseScoreCell(raw: string | undefined, maxPoints: number | null): number | null {
  const v = (raw ?? "").trim();
  if (!v || v === "-" || /^ex(cused)?$/i.test(v)) return null;
  if (/^(complete|pass)$/i.test(v)) return maxPoints ?? null;
  if (/^(incomplete|fail)$/i.test(v)) return 0;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseCanvasGradebook(csvText: string): ParsedCanvasGradebook {
  const warnings: string[] = [];
  const { data, errors } = Papa.parse<string[]>(csvText.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  if (errors.length) warnings.push(...errors.slice(0, 5).map((e) => `CSV row ${(e.row ?? 0) + 1}: ${e.message}`));
  if (data.length < 2) throw new Error("The file has no data rows. Is this a Canvas gradebook export?");

  const header = data[0].map((h) => h.trim());
  const identityIdx = new Map<number, keyof Omit<CanvasStudentRow, "scores"> | null>();
  const assignmentIdx: { idx: number; key: string; title: string; canvasId: string | null }[] = [];
  const skippedColumns: string[] = [];

  header.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (lower in IDENTITY_COLUMNS) {
      identityIdx.set(idx, IDENTITY_COLUMNS[lower]);
      return;
    }
    const m = h.match(ASSIGNMENT_HEADER);
    if (m) {
      assignmentIdx.push({ idx, key: h, title: m[1].trim(), canvasId: m[2] });
    } else if (!h || COMPUTED_HEADER.test(h)) {
      if (h) skippedColumns.push(h);
    } else {
      assignmentIdx.push({ idx, key: h, title: h, canvasId: null });
      warnings.push(`Column "${h}" has no Canvas ID; it will be matched by title.`);
    }
  });

  const has = (field: string) => [...identityIdx.values()].includes(field as never);
  if (!has("name")) throw new Error('Missing "Student" column. Is this a Canvas gradebook export?');
  if (!has("sisLoginId") && !has("sisUserId")) {
    warnings.push('No "SIS Login ID" or "SIS User ID" column found; students cannot be matched automatically.');
  }

  const maxPoints = new Map<number, number | null>();
  const studentRows: string[][] = [];
  for (const row of data.slice(1)) {
    const first = (row[0] ?? "").trim();
    if (/^points possible$/i.test(first)) {
      for (const a of assignmentIdx) maxPoints.set(a.idx, parseScoreCell(row[a.idx], null));
    } else if (first && !isTestStudent(first)) {
      // Metadata rows ("Manual Posting", "(read only)") have no student name.
      studentRows.push(row);
    }
  }

  const assignments: CanvasAssignment[] = assignmentIdx.map((a) => ({
    key: a.key,
    title: a.title,
    canvasId: a.canvasId,
    maxPoints: maxPoints.get(a.idx) ?? null,
    gradedCount: 0,
  }));

  const students = studentRows.map((row) => {
    const student: CanvasStudentRow = { name: "", canvasUserId: "", sisUserId: "", sisLoginId: "", section: "", scores: {} };
    for (const [idx, field] of identityIdx) if (field) student[field] = (row[idx] ?? "").trim();
    assignmentIdx.forEach((a, i) => {
      const score = parseScoreCell(row[a.idx], assignments[i].maxPoints);
      student.scores[a.key] = score;
      if (score !== null) assignments[i].gradedCount++;
    });
    return student;
  });

  if (!maxPoints.size) warnings.push('No "Points Possible" row found; enter max points manually for each assignment.');
  if (!students.length) warnings.push("No student rows were found.");

  return { assignments, students, skippedColumns, warnings };
}

/** Normalizes a Canvas login/email for matching against user emails. */
export function normalizeLogin(login: string, defaultDomain = "sampoerna.ac.id"): string {
  const v = login.trim().toLowerCase();
  if (!v) return "";
  return v.includes("@") ? v : `${v}@${defaultDomain}`;
}
