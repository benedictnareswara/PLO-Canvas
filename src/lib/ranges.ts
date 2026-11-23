/**
 * Allowed ranges for every number a user can enter. Shared by the forms (client), the API
 * validators (zod) and the Mongoose models, so all three refuse the same values. No value may be
 * negative.
 */
export const RANGES = {
  /** Percentages: PLO weights, share of the course grade, targets/thresholds. */
  percent: { min: 0, max: 100 },
  /** Assessment maximum points (must be above 0, so score ÷ max is defined). */
  maxPoints: { min: 0.01, max: 100_000 },
  /** Calendar years: curriculum year, academic year of a class, student entry year. */
  year: { min: 1990, max: 2100 },
  /** Credits of one course. */
  sks: { min: 0, max: 24 },
  /** Total credits of a curriculum. */
  totalSks: { min: 0, max: 400 },
  /** Recommended / student semester (proposal UC-03: 1 to 14). */
  semester: { min: 1, max: 14 },
  /** PLO numbers: a curriculum can define up to 50 PLOs (the CS 2024 curriculum uses 10). */
  ploNumber: { min: 1, max: 50 },
} as const;

/** Student number (NIM): digits only, so it can't be negative or contain other characters. */
export const NIM_PATTERN = /^\d{1,20}$/;

export type RangeName = keyof typeof RANGES;

/** Clamps a number into a range (used by sliders and percentage inputs). */
export function clamp(value: number, { min, max }: { min: number; max: number }): number {
  return Math.min(max, Math.max(min, value));
}

/** Removes minus signs so a negative number can't be typed or pasted into a numeric field. */
export function stripNegative(text: string): string {
  return text.replace(/[-−‒–—]/g, "");
}
