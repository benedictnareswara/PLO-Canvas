import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/**
 * Ends a session whose user no longer exists or was deactivated. Without clearing the cookie the
 * proxy (which only checks the token) would send /login straight back to the app: a redirect loop.
 */
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login?reason=expired", req.url));
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
