import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/models";

export const SESSION_COOKIE = "obe_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // one working day

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  roles: Role[];
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (min 16 chars). See .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, roles: payload.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

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
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
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
