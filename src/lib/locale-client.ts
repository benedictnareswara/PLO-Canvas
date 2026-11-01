"use client";

import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, type Locale } from "@/i18n/config";

/**
 * Switches the UI language. Signed in: saved to the account (the route also sets the cookie).
 * Signed out (the sign-in page): cookie only, adopted by the account at the next sign-in.
 * The caller then runs router.refresh() so server components re-render in the new language.
 */
export async function changeLocale(locale: Locale, { signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    if (res.ok) return;
  }
  const { path, maxAge, sameSite } = LOCALE_COOKIE_OPTIONS;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=${path}; max-age=${maxAge}; samesite=${sameSite}`;
}
