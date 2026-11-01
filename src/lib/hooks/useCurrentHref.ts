"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** The current path with its query, e.g. for a `?from=` that returns to the same filtered view. */
export function useCurrentHref(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search ? `${pathname}?${search}` : pathname;
}
