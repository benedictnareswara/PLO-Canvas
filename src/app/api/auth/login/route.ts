import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, HttpError } from "@/lib/auth/rbac";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, homeForRoles, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { loginThrottle } from "@/lib/auth/throttle";
import { User, type Role } from "@/models";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, isLocale } from "@/i18n/config";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

// Checked when the email is unknown, so a wrong email takes as long as a wrong password and the
// response time doesn't reveal which accounts exist.
const dummyHash = hashPassword("not-a-real-password");

export const POST = apiHandler(async (req) => {
  const { email, password } = schema.parse(await req.json());
  const minutes = loginThrottle.lockedFor(email);
  if (minutes) throw new HttpError(429, `Too many failed sign-ins. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);

  const user = await User.findOne({ email }).select("+passwordHash").lean();
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || user.isActive === false || !valid) {
    loginThrottle.fail(email);
    throw new HttpError(401, "Invalid email or password");
  }
  loginThrottle.succeed(email);

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
