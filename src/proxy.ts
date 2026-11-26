/**
 * The front door guard. Next.js runs this before every page and API request.
 * It reads the login cookie and decides:
 *   - not signed in            -> send to /login (or answer 401 for API calls)
 *   - signed in, on /login     -> send to your own home page
 *   - wrong role for a section -> send back to your own home page
 * It is only a quick first check. Each page and API route checks your permissions again
 * against the database, so this guard is never the only protection.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homeForRoles, verifySession } from "@/lib/auth/session";
import type { Role } from "@/models";

// Optimistic, cookie-only checks. Every page and route handler re-checks
// authorization against the database (see src/lib/auth/rbac.ts).
// Which roles may open which part of the site. A lecturer page also admits faculty heads.
const SECTION_ROLES: Record<string, Role[]> = {
  "/admin": ["superadmin"],
  "/head": ["faculty_head"],
  "/lecturer": ["lecturer", "faculty_head"],
  "/student": ["student"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL(homeForRoles(session.roles), request.url)) : NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/")) return NextResponse.next();
    return session ? NextResponse.next() : NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!session) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/") return NextResponse.redirect(new URL(homeForRoles(session.roles), request.url));

  const section = Object.keys(SECTION_ROLES).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (section && !SECTION_ROLES[section].some((r) => session.roles.includes(r))) {
    return NextResponse.redirect(new URL(homeForRoles(session.roles), request.url));
  }
  return NextResponse.next();
}

// Which web addresses the guard runs on: everything except built files, images and the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
