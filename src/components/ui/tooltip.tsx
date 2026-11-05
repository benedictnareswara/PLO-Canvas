"use client";

import { cloneElement, useId, useRef, type ReactElement, type ReactNode } from "react";
import { placeFloating, type FloatingSide } from "./floating";

/** Moving between tooltips within this window shows the next one instantly (no second delay). */
const WARM_MS = 400;
const DELAY_MS = 500;
let lastHiddenAt = 0;

/**
 * Supplementary hint for a control that already has an accessible name. Hover shows it after a
 * delay (only the first time; neighbours open instantly), keyboard focus shows it at once, Esc hides it.
 * The text is wired to the trigger with aria-describedby, so never put essential information here.
 */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: FloatingSide;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  function show(immediate: boolean) {
    window.clearTimeout(timer.current);
    const delay = immediate || Date.now() - lastHiddenAt < WARM_MS ? 0 : DELAY_MS;
    timer.current = window.setTimeout(() => {
      const tip = tipRef.current;
      const anchor = wrapRef.current?.firstElementChild;
      if (!tip || !anchor || tip.matches(":popover-open")) return;
      tip.showPopover();
      placeFloating(anchor, tip, { side });
    }, delay);
  }

  function hide() {
    window.clearTimeout(timer.current);
    const tip = tipRef.current;
    if (tip?.matches(":popover-open")) {
      tip.hidePopover();
      lastHiddenAt = Date.now();
    }
  }

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType === "mouse" && show(false)}
      onPointerLeave={hide}
      onFocus={(e) => (e.target as Element).matches(":focus-visible") && show(true)}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <div
        ref={tipRef}
        id={id}
        role="tooltip"
        popover="manual"
        className="ui-pop pointer-events-none max-w-64 rounded-md bg-foreground px-2 py-1 text-xs leading-snug font-medium text-background shadow-e2"
      >
        {content}
      </div>
    </span>
  );
}
