import { describe, expect, it } from "vitest";
import { escapeRegex, searchScope } from "@/lib/search/scope";

const ctx = { departmentCourseIds: ["c1", "c2"] };

describe("searchScope", () => {
  it("lets a superadmin search everything", () => {
    expect(searchScope({ id: "a", roles: ["superadmin"], department: null }, ctx)).toEqual({ students: { roles: "student" }, offerings: {}, courses: {} });
  });

  it("limits a lecturer to their advisees and the classes they teach", () => {
    expect(searchScope({ id: "l", roles: ["lecturer"], department: "d" }, ctx)).toEqual({
      students: { roles: "student", $or: [{ advisor: "l" }] },
      offerings: { $or: [{ lecturers: "l" }] },
      courses: null,
    });
  });

  it("adds the department's students and classes for a faculty head (read access)", () => {
    expect(searchScope({ id: "h", roles: ["faculty_head", "lecturer"], department: "d" }, ctx)).toEqual({
      students: { roles: "student", $or: [{ advisor: "h" }, { department: "d" }] },
      offerings: { $or: [{ lecturers: "h" }, { course: { $in: ["c1", "c2"] } }] },
      courses: null,
    });
  });

  it("gives students no search scope", () => {
    expect(searchScope({ id: "s", roles: ["student"], department: "d" }, ctx)).toEqual({ students: null, offerings: null, courses: null });
  });

  it("escapes regex metacharacters", () => {
    expect(new RegExp(escapeRegex("a.b*(c)"), "i").test("A.B*(C)")).toBe(true);
    expect(new RegExp(escapeRegex("a.b"), "i").test("axb")).toBe(false);
  });
});
