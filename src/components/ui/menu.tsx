"use client";

import Link from "next/link";
import { cloneElement, useEffect, useId, useRef, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "./index";
import { placeFloating, type FloatingAlign, type FloatingSide } from "./floating";

type TriggerProps = {
  id?: string;
  popoverTarget?: string;
  "aria-haspopup"?: "menu";
  "aria-controls"?: string;
};

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

function closeFrom(el: Element) {
  el.closest<HTMLElement>("[popover]")?.hidePopover();
}

/**
 * Menu button on the native Popover API: Esc, light dismiss and focus return come from the platform.
 * Arrow keys, Home and End move between items; Tab closes. `aria-expanded` is set on the trigger
 * by the platform through `popovertarget`.
 */
export function Menu({
  trigger,
  children,
  label,
  side = "bottom",
  align = "start",
  className,
}: {
  trigger: ReactElement<TriggerProps>;
  children: ReactNode;
  label: string;
  side?: FloatingSide;
  align?: FloatingAlign;
  className?: string;
}) {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const place = () => {
      const anchor = document.getElementById(triggerId);
      if (anchor && menu.matches(":popover-open")) placeFloating(anchor, menu, { side, align });
    };
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open") return;
      place();
      menu.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
    };
    menu.addEventListener("toggle", onToggle);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      menu.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [triggerId, side, align]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") e.currentTarget.hidePopover();
  }

  return (
    <>
      {cloneElement(trigger, { id: triggerId, popoverTarget: id, "aria-haspopup": "menu", "aria-controls": id })}
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn("ui-pop min-w-48 rounded-lg border border-border bg-surface p-1 text-sm text-foreground shadow-e3", className)}
      >
        {children}
      </div>
    </>
  );
}

const itemClass = cn(
  "flex w-full cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left outline-none select-none",
  "hover:bg-surface-2 focus-visible:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted",
  "aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:py-2.5",
);

export function MenuItem({
  onSelect,
  children,
  tone,
  disabled,
  className,
}: {
  onSelect?: () => void;
  children: ReactNode;
  tone?: "danger";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        closeFrom(e.currentTarget);
        onSelect?.();
      }}
      className={cn(itemClass, tone === "danger" && "text-risk [&_svg]:text-risk", className)}
    >
      {children}
    </button>
  );
}

export function MenuLink({ className, onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      role="menuitem"
      tabIndex={-1}
      onClick={(e) => {
        closeFrom(e.currentTarget);
        onClick?.(e);
      }}
      className={cn(itemClass, className)}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted">{children}</div>;
}
