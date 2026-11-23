import { describe, expect, it } from "vitest";
import { assessmentSchema, curriculumSchema, gradesSchema, offeringSchema, ploMappingSchema, ploSchema, userCreateSchema } from "@/lib/validators";

const id = (n: number) => n.toString(16).padStart(24, "0");

describe("validators: ranges and proposal rules", () => {
  const assessment = { title: "UTS", maxPoints: 100, gradeWeight: 30, ploWeights: [{ plo: id(1), weight: 40 }, { plo: id(6), weight: 60 }] };

  it("accepts an assessment whose PLO weights total 100%", () => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(true);
  });

  it("refuses PLO weights that don't total 100% (UC-05 5a)", () => {
    expect(assessmentSchema.safeParse({ ...assessment, ploWeights: [{ plo: id(1), weight: 90 }] }).success).toBe(false);
    expect(ploMappingSchema.safeParse({ ploWeights: [{ plo: id(1), weight: 50 }] }).success).toBe(false);
  });

  it("refuses negative or out-of-range numbers", () => {
    expect(assessmentSchema.safeParse({ ...assessment, maxPoints: 0 }).success).toBe(false);
    expect(assessmentSchema.safeParse({ ...assessment, maxPoints: -10 }).success).toBe(false);
    expect(assessmentSchema.safeParse({ ...assessment, gradeWeight: -1 }).success).toBe(false);
    expect(assessmentSchema.safeParse({ ...assessment, gradeWeight: 101 }).success).toBe(false);
    expect(gradesSchema.safeParse({ grades: [{ student: id(1), assessment: id(2), score: -1 }] }).success).toBe(false);
    expect(ploSchema.safeParse({ curriculum: id(1), number: 11, shortLabel: "x", description: "y" }).success).toBe(false);
    expect(curriculumSchema.safeParse({ name: "CS", year: 2024, totalSks: -1, department: id(1) }).success).toBe(false);
  });

  it("lets a new class leave its target out (it takes the curriculum default)", () => {
    const res = offeringSchema.safeParse({ course: id(1), academicYear: 2026, term: "odd", lecturers: [] });
    expect(res.success).toBe(true);
    expect(res.data?.threshold).toBeUndefined();
    expect(offeringSchema.safeParse({ course: id(1), academicYear: 2026, term: "odd", lecturers: [], threshold: 120 }).success).toBe(false);
  });

  it("requires NIM, entry year and curriculum for a student (UC-01)", () => {
    const base = { email: "s@sampoerna.ac.id", name: "S", roles: ["student"], password: "Password123!" };
    expect(userCreateSchema.safeParse(base).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...base, studentId: "2026001", cohortYear: 2026, curriculum: id(3) }).success).toBe(true);
    expect(userCreateSchema.safeParse({ ...base, roles: ["lecturer"] }).success).toBe(true);
  });
});
