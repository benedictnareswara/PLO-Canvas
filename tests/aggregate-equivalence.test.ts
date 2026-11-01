import { describe, expect, it } from "vitest";
import { cumulativeForStudent, rowsToSums } from "@/lib/obe/aggregate";
import { cumulativePloAttainment } from "@/lib/obe/engine";
import { inPeriod, type PeriodFilter } from "@/lib/obe/semesters";
import type { AttainmentRow } from "@/lib/obe/types";

/** Deterministic pseudo-random numbers (mulberry32), so failures are reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRows(seed: number, n: number): AttainmentRow[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => ({
    student: `s${Math.floor(r() * 12)}`,
    offering: `o${i % 30}`,
    courseCode: `C${i % 30}`,
    ploNumber: 1 + Math.floor(r() * 10),
    value: Math.round(r() * 10000) / 100,
    // includes 0-SKS rows, which the engine ignores
    sks: [0, 1, 2, 3, 4, 6][Math.floor(r() * 6)],
    studentSemester: 1 + Math.floor(r() * 8),
  }));
}

/** The original row-based computation, kept here as the reference. */
function reference(rows: AttainmentRow[], studentId: string, period: PeriodFilter) {
  return cumulativePloAttainment(
    rows.filter((x) => x.student === studentId && inPeriod(x.studentSemester, period)).map((x) => ({ plo: x.ploNumber, value: x.value, sks: x.sks })),
  );
}

const PERIODS: PeriodFilter[] = ["all", "y1", "y2", "y3", "y4", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

describe("pre-aggregated attainment", () => {
  for (const seed of [1, 7, 42, 2026]) {
    it(`matches the row-based result for every student and period (seed ${seed})`, () => {
      const rows = randomRows(seed, 600);
      const sums = rowsToSums(rows);
      expect(sums.length).toBeLessThan(rows.length);
      for (const student of new Set(rows.map((x) => x.student))) {
        for (const period of PERIODS) {
          const expected = reference(rows, student, period);
          const actual = cumulativeForStudent(sums, student, period);
          expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
          // Same maths, different addition order: equal to well within display precision.
          for (const [plo, v] of expected) expect(actual.get(plo)).toBeCloseTo(v, 9);
        }
      }
    });
  }

  it("ignores rows without SKS, like the engine", () => {
    const rows: AttainmentRow[] = [
      { student: "a", offering: "o", courseCode: "C", ploNumber: 1, value: 90, sks: 0, studentSemester: 1 },
      { student: "a", offering: "o", courseCode: "C", ploNumber: 1, value: 60, sks: 3, studentSemester: 1 },
    ];
    expect(cumulativeForStudent(rowsToSums(rows), "a").get(1)).toBe(60);
  });
});
