import { describe, expect, it } from "vitest";
import { mergeRowsByUser } from "@/lib/canvas/merge";

const row = (name: string, scores: Record<string, number | null>, excused: string[] = []) => ({ name, scores, excused });

describe("mergeRowsByUser", () => {
  it("keeps one row per user and skips unmatched rows", () => {
    const { merged, conflicts } = mergeRowsByUser(
      [row("Jane", { q1: 8 }), row("Nobody", { q1: 5 }), row("Budi", { q1: 7 })],
      ["u1", null, "u2"],
    );
    expect(conflicts).toEqual([]);
    expect(merged.map((m) => m.userId)).toEqual(["u1", "u2"]);
  });

  it("merges a student listed once per section, taking the score from the row that has one", () => {
    const { merged, conflicts } = mergeRowsByUser(
      [row("Jane (A)", { q1: 8, q2: null }), row("Jane (B)", { q1: null, q2: 9 })],
      ["u1", "u1"],
    );
    expect(conflicts).toEqual([]);
    expect(merged).toEqual([{ userId: "u1", name: "Jane (A)", scores: { q1: 8, q2: 9 }, excused: [] }]);
  });

  it("accepts the same score on both rows", () => {
    const { merged, conflicts } = mergeRowsByUser([row("Jane", { q1: 8 }), row("Jane", { q1: 8 })], ["u1", "u1"]);
    expect(conflicts).toEqual([]);
    expect(merged[0].scores).toEqual({ q1: 8 });
  });

  it("reports different scores for the same cell", () => {
    const { conflicts } = mergeRowsByUser([row("Jane", { q1: 8 }), row("Jane", { q1: 6 })], ["u1", "u1"]);
    expect(conflicts).toEqual([{ name: "Jane", key: "q1", values: [8, 6] }]);
  });

  it("keeps an excused mark only while the cell has no score", () => {
    const { merged } = mergeRowsByUser(
      [row("Jane", { q1: null, q2: null }, ["q1", "q2"]), row("Jane", { q1: 7, q2: null })],
      ["u1", "u1"],
    );
    expect(merged[0].scores).toEqual({ q1: 7, q2: null });
    expect(merged[0].excused).toEqual(["q2"]);
  });
});
