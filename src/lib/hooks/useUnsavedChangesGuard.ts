"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/components/ui/confirm";

/**
 * Asks before unsaved edits are lost:
 * - reload, close tab, external links: the browser's own `beforeunload` prompt;
 * - in-app links (Next <Link> and plain <a>): intercepted in the capture phase, before Next's
 *   router sees the click, then confirmed with our dialog;
 * - the app's own router.push calls: `await confirmNavigation()` first.
 * Back/forward can't be cancelled reliably by any browser API, so those are not covered.
 */
export function useUnsavedChangesGuard(dirty: boolean, count = 1) {
  const router = useRouter();
  const confirm = useConfirm();
  const t = useTranslations("confirm");
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  const ask = useCallback(
    () =>
      confirm({
        title: t("leaveTitle"),
        body: t("leaveBody", { count }),
        confirmLabel: t("leaveAction"),
        cancelLabel: t("stay"),
        tone: "danger",
      }),
    [confirm, t, count],
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // beforeunload covers it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      void ask().then((ok) => {
        if (!ok) return;
        dirtyRef.current = false;
        router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture on window runs before React's listener on the root, so Next's <Link> never navigates.
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("click", onClick, true);
    };
  }, [dirty, ask, router]);

  /** Resolve true when it's safe to navigate away (nothing dirty, or the user chose to discard). */
  const confirmNavigation = useCallback(async () => !dirtyRef.current || (await ask()), [ask]);

  return { confirmNavigation };
}
