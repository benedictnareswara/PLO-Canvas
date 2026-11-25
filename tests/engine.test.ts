import { describe, expect, it } from "vitest";
import {
  assessedShare,
  cohortAggregate,
  courseGrade,
  coursePloAttainment,
  cumulativePloAttainment,
  effectivePloWeights,
  isAtRisk,
  isFullyAssessed,
  letterGrade,
  parseGradeScale,
  resolveGradeScale,
  DEFAULT_GRADE_SCALE,
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

describe("proposal worked example (§1.3, COMP1401)", () => {
  // Share of grade × PLO weight, with each assessment's PLO weights totalling 100%.
  const comp1401 = [
    { id: "quiz1", maxPoints: 100, gradeWeight: 10, ploWeights: [{ plo: 1, weight: 100 }] },
    { id: "a1", maxPoints: 50, gradeWeight: 20, ploWeights: [{ plo: 1, weight: 50 }, { plo: 6, weight: 50 }] },
    { id: "uts", maxPoints: 100, gradeWeight: 30, ploWeights: [{ plo: 1, weight: 40 }, { plo: 6, weight: 60 }] },
    { id: "uas", maxPoints: 100, gradeWeight: 40, ploWeights: [{ plo: 1, weight: 20 }, { plo: 6, weight: 80 }] },
  ];
  const andi = { quiz1: 80, a1: 35, uts: 60, uas: 85 };

  it("gives PLO 1 = 72.5% and PLO 6 = 75.0% (within 0.1 point, objective O2)", () => {
    const res = coursePloAttainment(comp1401, andi);
    expect(res.get(1)).toBeCloseTo(72.5, 1);
    expect(res.get(6)).toBeCloseTo(75.0, 1);
  });

  it("gives the cumulative values 70.6% (on target) and 68.5% (at-risk)", () => {
    const res = cumulativePloAttainment([
      { plo: 1 as number, value: 72.5, sks: 4 },
      { plo: 1, value: 68, sks: 3 },
      { plo: 6, value: 75, sks: 4 },
      { plo: 6, value: 62, sks: 4 },
    ]);
    expect(res.get(1)).toBeCloseTo(70.6, 1);
    expect(res.get(6)).toBeCloseTo(68.5, 1);
    expect(isAtRisk(res.get(1)!, 70)).toBe(false);
    expect(isAtRisk(res.get(6)!, 70)).toBe(true);
  });

  it("shows effective weights of share × PLO weight, scaled to 100 per PLO", () => {
    const eff = effectivePloWeights(comp1401);
    expect(eff.get(1)!.get("quiz1")).toBeCloseTo(25); // 10 of 40
    expect(eff.get(1)!.get("uts")).toBeCloseTo(30); // 12 of 40
    expect(eff.get(6)!.get("uas")).toBeCloseTo((32 / 60) * 100);
    expect(eff.get(6)!.has("quiz1")).toBe(false);
  });

  it("a larger share moves the result: the share is not ignored", () => {
    const heavyFinal = comp1401.map((a) => (a.id === "uas" ? { ...a, gradeWeight: 80 } : a));
    expect(coursePloAttainment(heavyFinal, andi).get(6)).toBeGreaterThan(75);
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
    expect(letterGrade(84)).toBe("B");
    expect(letterGrade(null)).toBe("–");
  });
  it("uses the SU scale by default: A 90, B 80, C 70, D 60, F below", () => {
    expect([100, 90, 89.9, 80, 79, 70, 69, 60, 59.9, 0].map((p) => letterGrade(p))).toEqual(["A", "A", "B", "B", "C", "C", "D", "D", "F", "F"]);
  });
  it("parses and applies a custom grade scale", () => {
    const scale = parseGradeScale("A=85\nB: 70, C 55%, E 0")!;
    expect(scale).toEqual([
      { letter: "A", min: 85 },
      { letter: "B", min: 70 },
      { letter: "C", min: 55 },
      { letter: "E", min: 0 },
    ]);
    expect(letterGrade(60, scale)).toBe("C");
    expect(resolveGradeScale(undefined)).toEqual(parseGradeScale(DEFAULT_GRADE_SCALE));
  });
  it("rejects grade scales that would leave grades without a letter", () => {
    expect(parseGradeScale("A 90, B 80")).toBeNull(); // does not reach 0
    expect(parseGradeScale("A 80, B 90, F 0")).toBeNull(); // not highest first
    expect(parseGradeScale("A 90, A 80, F 0")).toBeNull(); // repeated letter
    expect(parseGradeScale("A 120, F 0")).toBeNull(); // over 100
    expect(parseGradeScale("")).toBeNull();
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

describe("assessedShare (grade so far)", () => {
  const a = [
    { id: "q", maxPoints: 100, gradeWeight: 10, ploWeights: [] },
    { id: "m", maxPoints: 100, gradeWeight: 30, ploWeights: [] },
    { id: "f", maxPoints: 100, gradeWeight: 60, ploWeights: [] },
  ];
  it("is the graded share of the course grade", () => {
    expect(assessedShare(a, {})).toBe(0);
    expect(assessedShare(a, { q: 80, m: 70 })).toBe(40);
    expect(isFullyAssessed(assessedShare(a, { q: 80, m: 70, f: 0 }))).toBe(true);
    expect(isFullyAssessed(assessedShare(a, { q: 80, m: 70 }))).toBe(false);
  });
  it("counts assessments when no shares are set", () => {
    const noShares = a.map((x) => ({ ...x, gradeWeight: 0 }));
    expect(assessedShare(noShares, { q: 1 })).toBeCloseTo(33.33, 1);
  });
  it("is 0 for a course without assessments", () => {
    expect(assessedShare([], {})).toBe(0);
  });
});
