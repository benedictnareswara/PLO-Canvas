import { describe, expect, it } from "vitest";
import { diffFields, diffGrades } from "@/lib/audit/diff";
import { groupHistory, type HistoryEntry } from "@/lib/audit/history";

describe("diffGrades", () => {
  const current = new Map([
    ["s1:a1", 80],
    ["s2:a1", 70],
  ]);

  it("records new, changed and cleared scores with old and new values", () => {
    const out = diffGrades(
      current,
      [
        { student: "s1", assessment: "a1", score: 85 },
        { student: "s2", assessment: "a1", score: null },
        { student: "s3", assessment: "a1", score: 60 },
      ],
      () => "Midterm",
    );
    expect(out).toEqual([
      { action: "grade.set", student: "s1", assessment: "a1", assessmentTitle: "Midterm", before: 80, after: 85 },
      { action: "grade.clear", student: "s2", assessment: "a1", assessmentTitle: "Midterm", before: 70, after: null },
      { action: "grade.set", student: "s3", assessment: "a1", assessmentTitle: "Midterm", before: null, after: 60 },
    ]);
  });

  it("skips writes that change nothing", () => {
    expect(
      diffGrades(current, [
        { student: "s1", assessment: "a1", score: 80 },
        { student: "s9", assessment: "a1", score: null },
      ]),
    ).toEqual([]);
  });
});

describe("diffFields", () => {
  it("returns only the fields that changed", () => {
    expect(diffFields({ title: "Quiz", maxPoints: 10, gradeWeight: 5 }, { title: "Quiz", maxPoints: 20, gradeWeight: 5 })).toEqual({
      before: { maxPoints: 10 },
      after: { maxPoints: 20 },
    });
    expect(diffFields({ a: [1, 2] }, { a: [1, 2] })).toBeNull();
  });
});

describe("groupHistory", () => {
  const entry = (p: Partial<HistoryEntry>): HistoryEntry => ({
    id: Math.random().toString(),
    createdAt: "2026-11-01T07:00:00.000Z",
    actorName: "Rina",
    action: "grade.set",
    source: "manual",
    batch: "b1",
    student: null,
    assessment: null,
    before: null,
    after: null,
    ...p,
  });

  it("groups adjacent entries of one batch and counts grade changes", () => {
    const groups = groupHistory([
      entry({ batch: "b2", action: "threshold.update" }),
      entry({ batch: "b1" }),
      entry({ batch: "b1", action: "grade.clear" }),
      entry({ batch: "b1" }),
    ]);
    expect(groups.map((g) => [g.batch, g.kind, g.set, g.cleared, g.entries.length])).toEqual([
      ["b2", "threshold", 0, 0, 1],
      ["b1", "grades", 2, 1, 3],
    ]);
  });

  it("labels a batch with an import summary as an import", () => {
    const [g] = groupHistory([entry({ batch: "c", action: "canvas.import", source: "canvas" }), entry({ batch: "c", source: "canvas" })]);
    expect(g.kind).toBe("import");
    expect(g.set).toBe(1);
  });
});
