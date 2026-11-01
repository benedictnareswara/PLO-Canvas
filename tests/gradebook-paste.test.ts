import { describe, expect, it } from "vitest";
import { applyPaste, cellKey, parseClipboardMatrix } from "@/lib/gradebook/paste";

describe("parseClipboardMatrix", () => {
  it("splits tabs and newlines", () => {
    expect(parseClipboardMatrix("1\t2\n3\t4")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
  it("handles Windows line endings and the trailing newline spreadsheets add", () => {
    expect(parseClipboardMatrix("1\t2\r\n3\t4\r\n")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
  it("pads ragged rows and trims cells", () => {
    expect(parseClipboardMatrix(" 1 \t2\n3")).toEqual([
      ["1", "2"],
      ["3", ""],
    ]);
  });
  it("keeps a single value as a 1×1 matrix", () => {
    expect(parseClipboardMatrix("85,5")).toEqual([["85,5"]]);
  });
});

describe("applyPaste", () => {
  const students = ["s1", "s2", "s3"];
  const assessments = ["a1", "a2"];
  const empty = Object.fromEntries(students.flatMap((s) => assessments.map((a) => [cellKey(s, a), ""])));

  it("fills from the origin and reports changed keys", () => {
    const { next, changed } = applyPaste(empty, { row: 1, col: 0 }, [["10", "20"]], students, assessments);
    expect(next["s2:a1"]).toBe("10");
    expect(next["s2:a2"]).toBe("20");
    expect(changed).toEqual(["s2:a1", "s2:a2"]);
  });

  it("clips to the grid edges", () => {
    const { changed } = applyPaste(empty, { row: 2, col: 1 }, [["1", "2"], ["3", "4"]], students, assessments);
    expect(changed).toEqual(["s3:a2"]);
  });

  it("does not report cells whose text is unchanged", () => {
    const values = { ...empty, "s1:a1": "5" };
    expect(applyPaste(values, { row: 0, col: 0 }, [["5"]], students, assessments).changed).toEqual([]);
  });

  it("does not mutate the input", () => {
    applyPaste(empty, { row: 0, col: 0 }, [["9"]], students, assessments);
    expect(empty["s1:a1"]).toBe("");
  });
});
