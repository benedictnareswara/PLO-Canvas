"use client";

import "./globals.css";

/**
 * Last-resort boundary: the root layout itself failed, so there are no fonts, providers or
 * translations. Kept to plain markup in both languages.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 font-sans text-foreground">
        <main className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted" lang="id">
            Terjadi kesalahan
          </p>
          <p className="mt-3 text-sm text-muted">The app couldn&apos;t load. Try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Try again · Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
