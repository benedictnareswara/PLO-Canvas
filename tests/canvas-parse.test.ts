import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeLogin, parseCanvasGradebook, parseScoreCell } from "@/lib/canvas/parse";

const CSV = `Student,ID,SIS User ID,SIS Login ID,Section,Proposal (50101),Literature Review (50102),Current Score,Unposted Current Score,Final Score,Final Grade
    Points Possible,,,,,20.00,100.00,(read only),(read only),(read only),(read only)
"Wijaya, Andi",901,2023001,student1@my.sampoernauniversity.ac.id,COMP4334-A,18,EX,90,90,90,A
"Student, Test",999,,,COMP4334-A,10,50,0,0,0,E
"Lestari, Bunga",902,2023002,student2,COMP4334-A,-,72.5,72,72,72,B
`;

describe("parseCanvasGradebook", () => {
  const parsed = parseCanvasGradebook(CSV);

  it("extracts assignment titles, Canvas IDs and points possible", () => {
    expect(parsed.assignments).toEqual([
      { key: "Proposal (50101)", title: "Proposal", canvasId: "50101", maxPoints: 20, gradedCount: 1 },
      { key: "Literature Review (50102)", title: "Literature Review", canvasId: "50102", maxPoints: 100, gradedCount: 1 },
    ]);
  });

  it("skips computed score columns", () => {
    expect(parsed.skippedColumns).toEqual(["Current Score", "Unposted Current Score", "Final Score", "Final Grade"]);
  });

  it("skips the Points Possible and Test Student rows", () => {
    expect(parsed.students.map((s) => s.name)).toEqual(["Wijaya, Andi", "Lestari, Bunga"]);
  });

  it("reads identity columns and treats blank/-/EX as no grade", () => {
    const [andi, bunga] = parsed.students;
    expect(andi).toMatchObject({ canvasUserId: "901", sisUserId: "2023001", sisLoginId: "student1@my.sampoernauniversity.ac.id" });
    expect(andi.scores).toEqual({ "Proposal (50101)": 18, "Literature Review (50102)": null });
    expect(bunga.scores).toEqual({ "Proposal (50101)": null, "Literature Review (50102)": 72.5 });
  });

  it("keeps EX (excused) cells apart from blanks", () => {
    const [andi, bunga] = parsed.students;
    expect(andi.excused).toEqual(["Literature Review (50102)"]);
    expect(bunga.excused).toEqual([]);
  });

  it("skips negative scores and warns about them", () => {
    const res = parseCanvasGradebook(`Student,ID,SIS User ID,SIS Login ID,Section,Quiz (1)
    Points Possible,,,,,10.00
"A, B",1,2023001,a@my.sampoernauniversity.ac.id,S,-4
`);
    expect(res.students[0].scores).toEqual({ "Quiz (1)": null });
    expect(res.warnings).toContainEqual({ code: "negativeScores", params: { count: 1 } });
  });

  it("rejects files without a Student column", () => {
    expect(() => parseCanvasGradebook("a,b\n1,2\n")).toThrow(/Student/);
  });

  it("parses the bundled sample file", () => {
    const sample = readFileSync(path.join(__dirname, "../samples/canvas-gradebook-sample.csv"), "utf8");
    const res = parseCanvasGradebook(sample);
    expect(res.assignments.length).toBeGreaterThanOrEqual(4);
    expect(res.assignments.every((a) => a.canvasId && a.maxPoints)).toBe(true);
    expect(res.students.some((s) => /test/i.test(s.name))).toBe(false);
  });
});

describe("helpers", () => {
  it("parses special cells", () => {
    expect(parseScoreCell("complete", 10)).toBe(10);
    expect(parseScoreCell("incomplete", 10)).toBe(0);
    expect(parseScoreCell("1,000", null)).toBe(1000);
    expect(parseScoreCell("A", 10)).toBeNull();
  });
  it.each([
    ["8,5", 8.5],
    ["10,00", 10],
    ["72,25", 72.25],
    ["1,000", 1000],
    ["1,000.50", 1000.5],
    ["12,345,678", 12345678],
  ])("reads decimal commas and thousands separators: %j", (raw, expected) => {
    expect(parseScoreCell(raw, 10)).toBe(expected);
  });
  it("gives no score for comma text that is not one number", () => {
    expect(parseScoreCell("8,5,5", 10)).toBeNull();
    expect(parseScoreCell("-8,5", 10)).toBeNull();
  });
});

describe("exports with decimal commas", () => {
  it("reads Points Possible and scores the same way", () => {
    const res = parseCanvasGradebook(`Student,ID,SIS User ID,SIS Login ID,Section,Quiz 1 (101)
    Points Possible,,,,,"10,00"
"Doe, Jane",1,2025001,student1@my.sampoernauniversity.ac.id,A,"8,5"
`);
    expect(res.assignments[0].maxPoints).toBe(10);
    expect(res.students[0].scores).toEqual({ "Quiz 1 (101)": 8.5 });
  });
  it("normalizes bare logins to the university domain", () => {
    expect(normalizeLogin("Student2")).toBe("student2@my.sampoernauniversity.ac.id");
    expect(normalizeLogin("x@Other.edu")).toBe("x@other.edu");
  });
});
