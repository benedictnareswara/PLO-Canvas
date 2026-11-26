import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmProvider } from "@/components/ui/confirm";
import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme-colors";
import "./globals.css";

// Fonts are loaded once here. Inter is the main text font and Geist Mono is for code-like text.
// Each one becomes a CSS variable (--font-inter) that globals.css uses.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The page title shown in the browser tab, for example "My classes · PLO-Canvas".
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    description: t("description"),
  };
}

// How phones should show the page: full width, no zoom-out, and a browser bar in our colour.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLOR.light,
};

/**
 * The outer frame around every page. It sets the page language, applies the saved light/dark theme
 * before the page paints (so there is no flash), and provides translations, the confirm dialog and
 * the pop-up message area to everything inside.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light" suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
