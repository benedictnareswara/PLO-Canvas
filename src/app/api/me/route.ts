import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, requireApiUser } from "@/lib/auth/rbac";
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { User } from "@/models";

const schema = z.object({ locale: z.enum(LOCALES) }).strict();

/** The signed-in user's own preferences. Only the UI language is stored server-side. */
export const PATCH = apiHandler(async (req) => {
  const user = await requireApiUser();
  const { locale } = schema.parse(await req.json());
  await User.updateOne({ _id: user.id }, { $set: { locale } });
  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
  return res;
});
