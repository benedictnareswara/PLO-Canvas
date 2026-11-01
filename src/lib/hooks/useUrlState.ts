"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface UrlStateOptions<T> {
  parse?: (raw: string) => T | null;
  serialize?: (value: T) => string;
  /**
   * The server reads this param: navigate with router.replace so server components re-render.
   * Leave false for client-only state (filters, sort, what-ifs): history.replaceState updates the
   * URL and useSearchParams without refetching the page.
   */
  server?: boolean;
}

/**
 * State mirrored to one query-string key, so a reload keeps it and the URL can be shared.
 * The default value is never written to the URL.
 *
 * Local state is the source of truth and updates immediately; the URL follows. Reading straight
 * from useSearchParams would lag, because Next applies URL changes in a transition, and a
 * controlled input bound to it would drop keystrokes. URL changes made elsewhere (links,
 * back/forward) are still adopted.
 */
export function useUrlState<T = string>(key: string, defaultValue: T, options: UrlStateOptions<T> = {}): [T, (next: T) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const { parse = (raw: string) => raw as T, serialize = (v: T) => String(v), server = false } = options;

  const raw = params.get(key);
  const [current, setCurrent] = useState<string | null>(raw);
  const [seenRaw, setSeenRaw] = useState<string | null>(raw);
  // What we last wrote and haven't seen come back through useSearchParams yet. While set,
  // intermediate URL values (from fast typing) are ignored instead of overwriting newer input.
  const [pending, setPending] = useState<string | null | undefined>(undefined);

  if (raw !== seenRaw) {
    setSeenRaw(raw);
    if (pending === undefined) setCurrent(raw);
    else if (raw === pending) setPending(undefined);
  }

  const value = current === null ? defaultValue : (parse(current) ?? defaultValue);

  const setValue = useCallback(
    (next: T) => {
      const encoded = serialize(next);
      const stored = encoded === "" || encoded === serialize(defaultValue) ? null : encoded;
      setCurrent(stored);
      const url = new URL(window.location.href);
      if (url.searchParams.get(key) === stored) return;
      setPending(stored);
      if (stored === null) url.searchParams.delete(key);
      else url.searchParams.set(key, stored);
      const href = `${url.pathname}${url.search}${url.hash}`;
      if (server) router.replace(href, { scroll: false });
      // `null` state: Next merges its own router state and syncs useSearchParams. Passing
      // history.state would carry Next's internal marker, and Next would skip the sync.
      else window.history.replaceState(null, "", href);
    },
    // serialize/parse are usually inline lambdas; the key and default define the behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, server, router, defaultValue],
  );

  return [value, setValue];
}

export const urlNumber = {
  parse: (raw: string) => (raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null),
  serialize: (n: number) => String(n),
};

export const urlList = {
  parse: (raw: string) => raw.split(",").filter(Boolean),
  serialize: (list: string[]) => list.join(","),
};
