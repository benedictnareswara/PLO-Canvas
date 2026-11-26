/**
 * Canvas lists a student once per section, so one account can match several rows of an export.
 * Pure (no database), so the import and its tests share it.
 */

export interface ImportRow {
  name: string;
  scores: Record<string, number | null>;
  excused: string[];
}

export interface MergedRow {
  userId: string;
  name: string;
  scores: Record<string, number | null>;
  /** Excused keys that still have no score after merging. */
  excused: string[];
}

export interface MergeConflict {
  name: string;
  key: string;
  values: number[];
}

/**
 * One row per matched user, in order of first appearance. A cell takes the score from whichever
 * row has one; the same score on several rows is fine. Different scores for the same cell can't
 * be merged and are returned as conflicts. Rows without a user (`null`) are left out.
 */
export function mergeRowsByUser(rows: ImportRow[], userIds: (string | null)[]): { merged: MergedRow[]; conflicts: MergeConflict[] } {
  const byUser = new Map<string, { name: string; values: Map<string, Set<number>>; keys: Set<string>; excused: Set<string> }>();
  rows.forEach((row, i) => {
    const userId = userIds[i];
    if (!userId) return;
    const entry = byUser.get(userId) ?? { name: row.name, values: new Map(), keys: new Set(), excused: new Set() };
    for (const [key, score] of Object.entries(row.scores)) {
      entry.keys.add(key);
      if (score === null || score === undefined) continue;
      if (!entry.values.has(key)) entry.values.set(key, new Set());
      entry.values.get(key)!.add(score);
    }
    for (const key of row.excused) entry.excused.add(key);
    byUser.set(userId, entry);
  });

  const merged: MergedRow[] = [];
  const conflicts: MergeConflict[] = [];
  for (const [userId, entry] of byUser) {
    const scores: Record<string, number | null> = {};
    for (const key of entry.keys) {
      const values = [...(entry.values.get(key) ?? [])];
      if (values.length > 1) conflicts.push({ name: entry.name, key, values });
      scores[key] = values.length ? values[0] : null;
    }
    const excused = [...entry.excused].filter((key) => scores[key] === null || scores[key] === undefined);
    merged.push({ userId, name: entry.name, scores, excused });
  }
  return { merged, conflicts };
}
