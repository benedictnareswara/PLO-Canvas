import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, HttpError } from "@/lib/auth/rbac";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, homeForRoles, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { User, type Role } from "@/models";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, isLocale } from "@/i18n/config";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export const POST = apiHandler(async (req) => {
  const { email, password } = schema.parse(await req.json());
  const user = await User.findOne({ email }).select("+passwordHash").lean();
  if (!user || user.isActive === false || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  const roles = user.roles as Role[];
  const token = await signSession({ sub: String(user._id), email: user.email, name: user.name, roles });
  const res = NextResponse.json({ redirect: homeForRoles(roles) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);

  // Language follows the account; an account that never chose one adopts the sign-in page's choice.
  if (isLocale(user.locale)) {
    res.cookies.set(LOCALE_COOKIE, user.locale, LOCALE_COOKIE_OPTIONS);
  } else {
    const fromCookie = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))?.[1];
    if (isLocale(fromCookie)) await User.updateOne({ _id: user._id }, { $set: { locale: fromCookie } });
  }
  return res;
});
