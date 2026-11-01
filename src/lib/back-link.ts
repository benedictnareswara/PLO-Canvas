import type { Role } from "@/models";

/** Pages that link to a student profile, with the nav label key for the breadcrumb back to them. */
const ORIGINS: Record<string, string> = {
  "/head/at-risk": "nav.atRisk",
  "/head": "nav.cohortOverview",
  "/lecturer/advisees": "nav.myAdvisees",
  "/admin/users": "nav.users",
};

/**
 * Breadcrumb parent for a student profile: where the user came from (`?from=`), if it is one of
 * the known internal pages, otherwise the default for their role. Anything else is ignored, so
 * the parameter can't be used to point the link at another site.
 */
export function studentBackLink(from: string | undefined, roles: Role[]): { href: string; labelKey: string } {
  if (from && from.startsWith("/") && !from.startsWith("//")) {
    const path = from.split(/[?#]/)[0];
    if (ORIGINS[path]) return { href: from, labelKey: ORIGINS[path] };
  }
  if (roles.includes("faculty_head")) return { href: "/head/at-risk", labelKey: "nav.atRisk" };
  if (roles.includes("superadmin")) return { href: "/admin/users", labelKey: "nav.users" };
  return { href: "/lecturer/advisees", labelKey: "nav.myAdvisees" };
}
