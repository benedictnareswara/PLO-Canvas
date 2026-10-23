import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homeForRoles, verifySession } from "@/lib/auth/session";
import type { Role } from "@/models";

// Optimistic, cookie-only checks. Every page and route handler re-checks
// authorization against the database (see src/lib/auth/rbac.ts).
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
