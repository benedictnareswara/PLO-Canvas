import { describe, expect, it } from "vitest";
import { RANGES, clamp, stripNegative } from "@/lib/ranges";
import { blankCells, fillBlanks, valuesFromGrades } from "@/lib/gradebook/state";
import { coursePloAttainment } from "@/lib/obe/engine";

describe("number ranges", () => {
  it("drops minus signs so negatives can't be typed", () => {
    expect(stripNegative("-5")).toBe("5");
    expect(stripNegative("−12,5")).toBe("12,5");
    expect(stripNegative("85.5")).toBe("85.5");
  });

  it("clamps percentages to 0–100", () => {
    expect(clamp(150, RANGES.percent)).toBe(100);
    expect(clamp(-3, RANGES.percent)).toBe(0);
    expect(clamp(42, RANGES.percent)).toBe(42);
  });

  it("matches the proposal's limits", () => {
    expect(RANGES.ploNumber).toEqual({ min: 1, max: 10 });
    expect(RANGES.semester).toEqual({ min: 1, max: 14 });
    expect(RANGES.maxPoints.min).toBeGreaterThan(0);
  });
});

describe("count blanks as 0 (missing work)", () => {
  const assessments = [
    { id: "uts", maxPoints: 100, gradeWeight: 30 },
    { id: "uas", maxPoints: 100, gradeWeight: 70 },
  ];
  const values = valuesFromGrades(["dewi", "eka"], assessments, { dewi: { uts: 90 }, eka: { uts: 60, uas: 70 } });

  it("finds the blank cells of one assessment", () => {
    expect(blankCells(values, "uas", ["dewi", "eka"])).toEqual(["dewi:uas"]);
    expect(blankCells(values, "uts", ["dewi", "eka"])).toEqual([]);
  });

  it("sets only the blank cells to 0", () => {
    const { next, changed } = fillBlanks(values, "uas", ["dewi", "eka"]);
    expect(changed).toEqual(["dewi:uas"]);
    expect(next["dewi:uas"]).toBe("0");
    expect(next["eka:uas"]).toBe("70");
  });

  it("then lowers the attainment of a student who skipped the work", () => {
    const course = [
      { id: "uts", maxPoints: 100, gradeWeight: 30, ploWeights: [{ plo: 1, weight: 100 }] },
      { id: "uas", maxPoints: 100, gradeWeight: 70, ploWeights: [{ plo: 1, weight: 100 }] },
    ];
    expect(coursePloAttainment(course, { uts: 90 }).get(1)).toBeCloseTo(90); // skipped: not counted yet
    expect(coursePloAttainment(course, { uts: 90, uas: 0 }).get(1)).toBeCloseTo(27); // counted as 0
  });
});
