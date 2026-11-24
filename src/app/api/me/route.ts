import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, HttpError, requireApiUser } from "@/lib/auth/rbac";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { passwordChangeSchema, preferencesSchema } from "@/lib/validators";
import { User } from "@/models";

/** The signed-in user's own settings: UI language, or a password change. */
export const PATCH = apiHandler(async (req) => {
  const user = await requireApiUser();
  const body = await req.json();

  if (body && typeof body === "object" && "newPassword" in body) {
    const { currentPassword, newPassword } = passwordChangeSchema.parse(body);
    const stored = await User.findById(user.id).select("+passwordHash").lean();
    if (!stored || !(await verifyPassword(currentPassword, stored.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
    // Rounded down to the second, so the new session issued below (same second) stays valid while
    // every older one ends.
    const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await User.updateOne({ _id: user.id }, { $set: { passwordHash: await hashPassword(newPassword), passwordChangedAt: changedAt } });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await signSession({ sub: user.id, email: user.email, name: user.name, roles: user.roles }), sessionCookieOptions);
    return res;
  }

  const { locale } = preferencesSchema.parse(body);
  await User.updateOne({ _id: user.id }, { $set: { locale } });
  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
  return res;
});
