import { describe, expect, it } from "vitest";
import {
  cohortAggregate,
  courseGrade,
  coursePloAttainment,
  cumulativePloAttainment,
  effectivePloWeights,
  isAtRisk,
  letterGrade,
  scorePercentage,
} from "@/lib/obe/engine";
import { inPeriod, semesterRange, studentSemester } from "@/lib/obe/semesters";

describe("scorePercentage (formula 1)", () => {
  it("computes score / max × 100", () => {
    expect(scorePercentage(45, 60)).toBe(75);
  });
  it("clamps to 0–100 and guards zero max", () => {
    expect(scorePercentage(110, 100)).toBe(100);
    expect(scorePercentage(5, 0)).toBe(0);
  });
});

describe("coursePloAttainment (formula 2)", () => {
  const assessments = [
    { id: "quiz", maxPoints: 20, ploWeights: [{ plo: 1, weight: 30 }] },
    { id: "uts", maxPoints: 100, ploWeights: [{ plo: 1, weight: 70 }, { plo: 2, weight: 40 }] },
    { id: "uas", maxPoints: 50, ploWeights: [{ plo: 2, weight: 60 }] },
  ];

  it("matches the spec formula when weights per PLO sum to 100", () => {
    const res = coursePloAttainment(assessments, { quiz: 16, uts: 70, uas: 45 });
    // PLO1 = 80×0.30 + 70×0.70 = 73 ; PLO2 = 70×0.40 + 90×0.60 = 82
    expect(res.get(1)).toBeCloseTo(73);
    expect(res.get(2)).toBeCloseTo(82);
  });

  it("normalizes per-assessment weights that do not sum to 100 per PLO", () => {
    // Per-assessment split: A → 60% PLO4 / 40% PLO7, B → 100% PLO4
    const res = coursePloAttainment(
      [
        { id: "A", maxPoints: 100, ploWeights: [{ plo: 4, weight: 60 }, { plo: 7, weight: 40 }] },
        { id: "B", maxPoints: 100, ploWeights: [{ plo: 4, weight: 100 }] },
      ],
      { A: 50, B: 90 },
    );
    // PLO4 = (50×60 + 90×100) / 160 = 75 ; PLO7 = 50
    expect(res.get(4)).toBeCloseTo(75);
    expect(res.get(7)).toBeCloseTo(50);
  });

  it("skips ungraded assessments instead of counting them as zero", () => {
    const res = coursePloAttainment(assessments, { quiz: 16 });
    expect(res.get(1)).toBeCloseTo(80);
    expect(res.has(2)).toBe(false);
  });

  it("exposes effective normalized weights", () => {
    const eff = effectivePloWeights([
      { id: "A", maxPoints: 1, ploWeights: [{ plo: 4, weight: 60 }] },
      { id: "B", maxPoints: 1, ploWeights: [{ plo: 4, weight: 20 }] },
    ]);
    expect(eff.get(4)!.get("A")).toBeCloseTo(75);
    expect(eff.get(4)!.get("B")).toBeCloseTo(25);
  });
});

describe("cumulativePloAttainment (formula 3)", () => {
  it("weights by SKS and only counts courses mapping to the PLO", () => {
    const res = cumulativePloAttainment([
      { plo: 1 as number, value: 80, sks: 4 }, // COMP1401
      { plo: 1, value: 60, sks: 3 }, // COMP3315
      { plo: 8, value: 90, sks: 3 }, // COMP3312 (does not map PLO 1)
    ]);
    expect(res.get(1)).toBeCloseTo((80 * 4 + 60 * 3) / 7);
    expect(res.get(8)).toBeCloseTo(90);
    expect(res.has(5)).toBe(false);
  });
});

describe("cohortAggregate (formula 4)", () => {
  it("averages students' cumulative values, counting only students with evidence", () => {
    const res = cohortAggregate([new Map([[1, 80], [2, 60]]), new Map([[1, 60]])]);
    expect(res.get(1)).toMatchObject({ mean: 70, n: 2, min: 60, max: 80 });
    expect(res.get(2)).toMatchObject({ mean: 60, n: 1 });
  });
});

describe("at-risk and grading (formula 5)", () => {
  it("flags values strictly below the threshold", () => {
    expect(isAtRisk(69.9, 70)).toBe(true);
    expect(isAtRisk(70, 70)).toBe(false);
    expect(isAtRisk(null, 70)).toBe(false);
  });
  it("computes grade-weighted course grade and letter", () => {
    const a = [
      { id: "x", maxPoints: 10, gradeWeight: 40, ploWeights: [] },
      { id: "y", maxPoints: 100, gradeWeight: 60, ploWeights: [] },
    ];
    expect(courseGrade(a, { x: 9, y: 80 })).toBeCloseTo(84);
    expect(letterGrade(84)).toBe("A-");
    expect(letterGrade(null)).toBe("–");
  });
});

describe("semesters", () => {
  it("maps academic year + term to the student's semester number", () => {
    expect(studentSemester(2023, 2023, "odd")).toBe(1);
    expect(studentSemester(2023, 2024, "even")).toBe(4);
    expect(studentSemester(2024, 2026, "odd")).toBe(5);
  });
  it("filters by year and semester", () => {
    expect(semesterRange("y2")).toEqual([3, 4]);
    expect(inPeriod(4, "y2")).toBe(true);
    expect(inPeriod(5, "y2")).toBe(false);
    expect(inPeriod(7, "all")).toBe(true);
    expect(inPeriod(3, "s3")).toBe(true);
  });
});
