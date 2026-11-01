import { describe, expect, it } from "vitest";
import { studentBackLink } from "@/lib/back-link";

describe("studentBackLink", () => {
  it("follows a known internal origin, keeping its query", () => {
    expect(studentBackLink("/head/at-risk?period=y2", ["faculty_head"])).toEqual({ href: "/head/at-risk?period=y2", labelKey: "nav.atRisk" });
    expect(studentBackLink("/lecturer/advisees", ["faculty_head", "lecturer"]).labelKey).toBe("nav.myAdvisees");
  });
  it("ignores unknown or external origins and falls back by role", () => {
    expect(studentBackLink("//evil.example/head", ["lecturer"]).href).toBe("/lecturer/advisees");
    expect(studentBackLink("https://evil.example", ["faculty_head"]).href).toBe("/head/at-risk");
    expect(studentBackLink("/admin/secret", ["superadmin"]).href).toBe("/admin/users");
    expect(studentBackLink(undefined, ["lecturer"]).href).toBe("/lecturer/advisees");
  });
});
