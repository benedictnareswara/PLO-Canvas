/**
 * Scores may exceed max points (bonus marks) but not by more than this factor. Shared by the
 * client-side validation and the grades API so both reject the same values.
 */
export const MAX_SCORE_FACTOR = 1.5;

/**
 * Locale-tolerant score parser: "85,5" | "85.5" | " 90 " → number; "" → null; anything else → NaN.
 * A single comma is read as a decimal separator (Indonesian keyboards and spreadsheets use it).
 */
export function parseScore(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (s === "") return null;
  const normalized = /^-?\d+,\d+$/.test(s) ? s.replace(",", ".") : s;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
}

export type ScoreError = "notNumber" | "negative" | "tooHigh";

/** Validation result for one cell: the parsed value (null = not graded) or an error code. */
export function validateScore(raw: string, maxPoints: number): { value: number | null; error?: ScoreError } {
  const value = parseScore(raw);
  if (value === null) return { value };
  if (Number.isNaN(value)) return { value, error: "notNumber" };
  if (value < 0) return { value, error: "negative" };
  if (value > maxPoints * MAX_SCORE_FACTOR) return { value, error: "tooHigh" };
  return { value };
}

/** Canonical text for a stored score, so "85.50" and "85.5" compare equal. */
export function formatScoreInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
