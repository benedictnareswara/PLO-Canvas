/**
 * Login sessions. After you sign in, the server gives your browser a signed "ticket" (a JWT) that
 * says who you are and what roles you have. The browser sends it back on every request.
 * It is signed with JWT_SECRET, so nobody can forge or change a ticket without the secret.
 * The `jose` library does the signing and checking.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/models";

// The name of the cookie that holds the ticket in the browser.
export const SESSION_COOKIE = "obe_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // one working day

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  roles: Role[];
  /** Issued-at, in seconds (set on verified tokens). */
  iat?: number;
}

// Reads JWT_SECRET from the settings and refuses to run if it is missing, too short, or still the example.
function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (min 16 chars). See .env.example.");
  }
  if (secret === "change-me-to-a-long-random-string" && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET still has the example value. Set your own random string in .env (README step 2).");
  }
  return new TextEncoder().encode(secret);
}

/** Makes a new signed ticket for a user. It expires after SESSION_TTL_SECONDS (8 hours). */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, roles: payload.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Checks a ticket. Gives back who the user is, or null if it is missing, fake, changed or expired. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      roles: (payload.roles as Role[]) ?? [],
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

// How the cookie is stored: httpOnly = page scripts cannot read it; sameSite lax = not sent along
// with requests started by other websites; maxAge = how long the browser keeps it.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Secure cookies need HTTPS. Follow the app's own address, so a production build served over
  // plain http on a local machine (http://localhost:3000, a campus IP) can still sign in.
  secure: (process.env.APP_URL ?? "").startsWith("https://"),
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

/** Landing page for a user, by highest-privilege role. */
export function homeForRoles(roles: Role[]): string {
  if (roles.includes("superadmin")) return "/admin";
  if (roles.includes("faculty_head")) return "/head";
  if (roles.includes("lecturer")) return "/lecturer";
  if (roles.includes("student")) return "/student";
  return "/login";
}
