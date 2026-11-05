export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
/** Not httpOnly: the sign-in page switches language client-side before anyone is signed in. */
export const LOCALE_COOKIE_OPTIONS = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365 };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

/** BCP 47 tags used for Intl number/date formatting. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  id: "id-ID",
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
