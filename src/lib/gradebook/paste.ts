/**
 * Parses a clipboard block from Excel, Google Sheets or Numbers (tab-separated, one row per line)
 * into a rectangular matrix. Handles \r\n line endings and the trailing newline spreadsheets add;
 * short rows are padded with "" so every row has the same width.
 */
export function parseClipboardMatrix(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const rows = lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => (r.length < width ? [...r, ...Array(width - r.length).fill("")] : r));
}

export function cellKey(studentId: string, assessmentId: string): string {
  return `${studentId}:${assessmentId}`;
}

/**
 * Writes a pasted matrix into the grid starting at (row, col) of the *visible* students and
 * assessments, clipped to the grid's edges. Returns the next values and the keys that changed
 * (for one undo step and the dirty markers). Cells whose text doesn't change are not reported.
 */
export function applyPaste(
  values: Record<string, string>,
  origin: { row: number; col: number },
  matrix: string[][],
  studentIds: string[],
  assessmentIds: string[],
): { next: Record<string, string>; changed: string[] } {
  const next = { ...values };
  const changed: string[] = [];
  matrix.forEach((cells, r) => {
    const student = studentIds[origin.row + r];
    if (!student) return;
    cells.forEach((cell, c) => {
      const assessment = assessmentIds[origin.col + c];
      if (!assessment) return;
      const key = cellKey(student, assessment);
      if (next[key] !== cell) {
        next[key] = cell;
        changed.push(key);
      }
    });
  });
  return { next, changed };
}
