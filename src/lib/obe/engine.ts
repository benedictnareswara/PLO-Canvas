/**
 * Pure OBE calculation engine (DIKTI / IABEE conventions).
 * No database access here so every formula is unit-testable.
 */

export const DEFAULT_THRESHOLD = 70;

export interface PloWeight<K extends string | number = string> {
  plo: K;
  weight: number;
}

export interface AssessmentInput<K extends string | number = string> {
  id: string;
  maxPoints: number;
  gradeWeight?: number;
  ploWeights: PloWeight<K>[];
}

/** (1) Score Percentage = score / maxPoints × 100, clamped to [0, 100]. */
export function scorePercentage(score: number, maxPoints: number): number {
  if (!(maxPoints > 0) || !Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, (score / maxPoints) * 100));
}

/**
 * (2) Course-level PLO attainment for one student:
 *   PLO_c,k = Σ_a ScorePct_a × w_a,k
 * where the weights w_a,k of PLO k must sum to 100% across the course.
 *
 * Lecturers enter weights per assessment (e.g. "60% PLO 4 / 40% PLO 7"), so the
 * weights of a PLO are normalized over the *graded* assessments that map to it:
 *   PLO_c,k = Σ_a ScorePct_a × w_a,k / Σ_a w_a,k
 * This is identical to the spec formula whenever the weights already sum to 100,
 * and it skips ungraded assessments so in-progress courses are not penalized.
 *
 * @param scores assessmentId → raw score (missing/undefined = not graded)
 * @returns PLO key → attainment (0–100); PLOs with no graded evidence are omitted
 */
export function coursePloAttainment<K extends string | number>(
  assessments: AssessmentInput<K>[],
  scores: Map<string, number | undefined> | Record<string, number | undefined>,
): Map<K, number> {
  const get = (id: string) => (scores instanceof Map ? scores.get(id) : scores[id]);
  const acc = new Map<K, { sum: number; weight: number }>();

  for (const a of assessments) {
    const score = get(a.id);
    if (score === undefined || score === null || Number.isNaN(score)) continue;
    const pct = scorePercentage(score, a.maxPoints);
    for (const { plo, weight } of a.ploWeights) {
      if (!(weight > 0)) continue;
      const cur = acc.get(plo) ?? { sum: 0, weight: 0 };
      cur.sum += pct * weight;
      cur.weight += weight;
      acc.set(plo, cur);
    }
  }

  const out = new Map<K, number>();
  for (const [plo, { sum, weight }] of acc) {
    if (weight > 0) out.set(plo, sum / weight);
  }
  return out;
}

/**
 * Effective (normalized) weight of each assessment per PLO, i.e. w_a,k such that
 * Σ_a w_a,k = 100 for every PLO k. Used to show lecturers the real contribution.
 */
export function effectivePloWeights<K extends string | number>(
  assessments: AssessmentInput<K>[],
): Map<K, Map<string, number>> {
  const totals = new Map<K, number>();
  for (const a of assessments)
    for (const { plo, weight } of a.ploWeights)
      if (weight > 0) totals.set(plo, (totals.get(plo) ?? 0) + weight);

  const out = new Map<K, Map<string, number>>();
  for (const a of assessments) {
    for (const { plo, weight } of a.ploWeights) {
      const total = totals.get(plo);
      if (!(weight > 0) || !total) continue;
      if (!out.has(plo)) out.set(plo, new Map());
      out.get(plo)!.set(a.id, (weight / total) * 100);
    }
  }
  return out;
}

/** Overall course grade (%) = Σ ScorePct × gradeWeight / Σ gradeWeight over graded assessments. */
export function courseGrade(
  assessments: AssessmentInput<string | number>[],
  scores: Map<string, number | undefined> | Record<string, number | undefined>,
): number | null {
  const get = (id: string) => (scores instanceof Map ? scores.get(id) : scores[id]);
  const graded = assessments.filter((a) => {
    const s = get(a.id);
    return s !== undefined && s !== null && !Number.isNaN(s);
  });
  if (graded.length === 0) return null;
  const totalWeight = graded.reduce((s, a) => s + (a.gradeWeight ?? 0), 0);
  // Fall back to an unweighted mean when no grade weights are configured.
  if (totalWeight <= 0) {
    return graded.reduce((s, a) => s + scorePercentage(get(a.id)!, a.maxPoints), 0) / graded.length;
  }
  return (
    graded.reduce((s, a) => s + scorePercentage(get(a.id)!, a.maxPoints) * (a.gradeWeight ?? 0), 0) /
    totalWeight
  );
}

/** Letter grade scale (minimum percentage for each letter). Adjust here if the registry changes it. */
export const LETTER_SCALE: { letter: string; min: number }[] = [
  { letter: "A", min: 85 },
  { letter: "A-", min: 80 },
  { letter: "B+", min: 75 },
  { letter: "B", min: 70 },
  { letter: "B-", min: 65 },
  { letter: "C+", min: 60 },
  { letter: "C", min: 55 },
  { letter: "D", min: 45 },
  { letter: "E", min: 0 },
];

export function letterGrade(pct: number | null): string {
  if (pct === null || Number.isNaN(pct)) return "–";
  return LETTER_SCALE.find((l) => pct >= l.min)?.letter ?? "E";
}

export interface CourseAttainmentEntry<K extends string | number = number> {
  plo: K;
  value: number;
  sks: number;
}

/**
 * (3) Multi-semester cumulative PLO attainment, SKS-weighted:
 *   Cumulative PLO_k = Σ_c (PLO_c,k × SKS_c) / Σ_c SKS_c
 * The denominator only includes courses that produced a value for PLO k.
 */
export function cumulativePloAttainment<K extends string | number>(
  entries: CourseAttainmentEntry<K>[],
): Map<K, number> {
  const acc = new Map<K, { sum: number; sks: number }>();
  for (const { plo, value, sks } of entries) {
    if (!(sks > 0) || !Number.isFinite(value)) continue;
    const cur = acc.get(plo) ?? { sum: 0, sks: 0 };
    cur.sum += value * sks;
    cur.sks += sks;
    acc.set(plo, cur);
  }
  const out = new Map<K, number>();
  for (const [plo, { sum, sks }] of acc) out.set(plo, sum / sks);
  return out;
}

export interface CohortStat {
  mean: number;
  n: number;
  min: number;
  max: number;
}

/**
 * (4) Cohort aggregate: mean of each student's cumulative PLO_k.
 * N counts only students who have evidence for PLO k.
 */
export function cohortAggregate<K extends string | number>(perStudent: Map<K, number>[]): Map<K, CohortStat> {
  const acc = new Map<K, number[]>();
  for (const m of perStudent)
    for (const [plo, v] of m) {
      if (!acc.has(plo)) acc.set(plo, []);
      acc.get(plo)!.push(v);
    }
  const out = new Map<K, CohortStat>();
  for (const [plo, vals] of acc) {
    out.set(plo, {
      mean: vals.reduce((s, v) => s + v, 0) / vals.length,
      n: vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
    });
  }
  return out;
}

/** (5) At-risk flag: PLO_k < threshold. Missing values are not flagged (no evidence yet). */
export function isAtRisk(value: number | null | undefined, threshold = DEFAULT_THRESHOLD): boolean {
  return value !== null && value !== undefined && Number.isFinite(value) && value < threshold;
}

export function round1(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}
