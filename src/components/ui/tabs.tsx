"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./index";

export interface TabItem {
  key: string;
  label: ReactNode;
  content: ReactNode;
}

/**
 * WAI-ARIA tabs with automatic activation: one tab stop, arrows/Home/End move and select.
 * The active tab is mirrored to `?tab=` with history.replaceState, which Next keeps in sync with
 * useSearchParams without a server round trip. The underline slides between tabs (off under
 * reduced motion).
 */
export function Tabs({
  tabs,
  initial,
  label,
  sticky = false,
}: {
  tabs: TabItem[];
  initial?: string;
  label?: string;
  /** Keep the tab bar visible under the app's top bar while scrolling. */
  sticky?: boolean;
}) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(initial && tabs.some((t) => t.key === initial) ? initial : tabs[0]?.key);
  const current = tabs.some((t) => t.key === active) ? active : tabs[0]?.key;

  // Position the underline directly on the DOM (no re-render), and re-measure when labels resize.
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    const measure = () => {
      const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!tab) return;
      indicator.style.width = `${tab.offsetWidth}px`;
      indicator.style.translate = `${tab.offsetLeft}px 0`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [current, tabs.length]);

  // Enable the slide only after the first placement, so the underline doesn't sweep in on load.
  useEffect(() => {
    const frame = requestAnimationFrame(() => indicatorRef.current?.setAttribute("data-ready", ""));
    return () => cancelAnimationFrame(frame);
  }, []);

  function select(key: string, focus = false) {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
    if (focus) document.getElementById(`${id}-tab-${key}`)?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.key === current);
    const target =
      e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (target === null) return;
    e.preventDefault();
    select(tabs[(target + tabs.length) % tabs.length].key, true);
  }

  return (
    <div>
      <div
        className={cn(
          "mb-5 border-b border-border",
          sticky && "sticky top-(--app-sticky-top,0px) z-10 -mx-4 bg-background px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        )}
      >
        <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((t) => {
            const selected = t.key === current;
            return (
              <button
                key={t.key}
                id={`${id}-tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-panel-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(t.key)}
                className={cn(
                  "relative whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-(--dur-1)",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                  selected ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
          <span
            ref={indicatorRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-brand",
              "data-ready:transition-[translate,width] data-ready:duration-(--dur-2) data-ready:ease-(--ease-std) motion-reduce:transition-none",
            )}
          />
        </div>
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          id={`${id}-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${t.key}`}
          tabIndex={0}
          hidden={t.key !== current}
          className="outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
