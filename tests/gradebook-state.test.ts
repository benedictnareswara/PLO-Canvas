import { describe, expect, it } from "vitest";
import { buildSavePayload, dirtyKeys, invalidCells, previewCourseGrade, rebase, valuesFromGrades } from "@/lib/gradebook/state";

const assessments = [
  { id: "a1", maxPoints: 100, gradeWeight: 40 },
  { id: "a2", maxPoints: 50, gradeWeight: 60 },
];

describe("gradebook state", () => {
  const baseline = valuesFromGrades(["s1", "s2"], assessments, { s1: { a1: 80 }, s2: { a1: 70, a2: 25 } });

  it("builds text values for every cell", () => {
    expect(baseline).toEqual({ "s1:a1": "80", "s1:a2": "", "s2:a1": "70", "s2:a2": "25" });
  });

  it("ignores edits that mean the same number", () => {
    expect(dirtyKeys({ ...baseline, "s1:a1": "80,0", "s2:a2": " 25" }, baseline)).toEqual([]);
    expect(dirtyKeys({ ...baseline, "s1:a2": "40" }, baseline)).toEqual(["s1:a2"]);
  });

  it("validates against each assessment's max", () => {
    const values = { ...baseline, "s1:a2": "80", "s2:a2": "x" };
    const invalid = invalidCells(["s1:a2", "s2:a2"], values, new Map(assessments.map((a) => [a.id, a.maxPoints])));
    expect(Object.fromEntries(invalid)).toEqual({ "s1:a2": "tooHigh", "s2:a2": "notNumber" });
  });

  it("sends only changed cells with the value they replace", () => {
    const values = { ...baseline, "s1:a1": "", "s1:a2": "45,5" };
    expect(buildSavePayload(dirtyKeys(values, baseline), values, baseline)).toEqual([
      { student: "s1", assessment: "a1", score: null, expected: 80 },
      { student: "s1", assessment: "a2", score: 45.5, expected: null },
    ]);
  });

  it("rebases on fresh server data but keeps dirty edits", () => {
    const values = { ...baseline, "s1:a2": "30" };
    const server = { ...baseline, "s1:a2": "10", "s2:a1": "75" };
    const next = rebase(values, baseline, server)!;
    expect(next.values["s1:a2"]).toBe("30"); // my edit survives
    expect(next.values["s2:a1"]).toBe("75"); // untouched cell follows the server
    expect(next.baseline).toEqual(server);
    expect(rebase(baseline, baseline, baseline)).toBeNull();
  });

  it("previews the course grade from typed values", () => {
    expect(previewCourseGrade("s2", assessments, baseline)).toEqual({ pct: 0.4 * 70 + 0.6 * 50, letter: "C" });
    // invalid cells are ignored rather than crashing the preview
    expect(previewCourseGrade("s2", assessments, { ...baseline, "s2:a2": "abc" }).pct).toBe(70);
  });
});
