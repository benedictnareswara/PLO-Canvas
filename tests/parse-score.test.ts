import { describe, expect, it } from "vitest";
import { MAX_SCORE_FACTOR, parseScore, validateScore } from "@/lib/gradebook/parse-score";

describe("parseScore", () => {
  it.each([
    ["85.5", 85.5],
    ["85,5", 85.5],
    [" 90 ", 90],
    ["0", 0],
    [".5", 0.5],
    ["100.", 100],
    ["1 000", 1000],
  ])("parses %j", (raw, expected) => {
    expect(parseScore(raw)).toBe(expected);
  });

  it("treats blank as not graded", () => {
    expect(parseScore("")).toBeNull();
    expect(parseScore("   ")).toBeNull();
  });

  it.each(["abc", "8,5,5", "1.2.3", "85%", "1e3", "--1"])("rejects %j", (raw) => {
    expect(parseScore(raw)).toBeNaN();
  });
});

describe("validateScore", () => {
  it("accepts scores up to the bonus cap shared with the server", () => {
    expect(validateScore(String(100 * MAX_SCORE_FACTOR), 100)).toEqual({ value: 150 });
    expect(validateScore("150,5", 100)).toEqual({ value: 150.5, error: "tooHigh" });
  });
  it("flags negatives and garbage", () => {
    expect(validateScore("-1", 100).error).toBe("negative");
    expect(validateScore("x", 100).error).toBe("notNumber");
  });
  it("allows blank", () => {
    expect(validateScore("", 100)).toEqual({ value: null });
  });
});
