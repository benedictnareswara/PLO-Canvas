"use client";

import { useEffect, useRef } from "react";

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

interface Combo {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

/** "mod+s", "mod+shift+k", "alt+h", "?" — `mod` is ⌘ on Apple platforms and Ctrl elsewhere. */
export function parseHotkey(combo: string): Combo {
  const parts = combo.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  return { mod: parts.includes("mod"), shift: parts.includes("shift"), alt: parts.includes("alt"), key };
}

export function matchesHotkey(e: KeyboardEvent, combo: Combo, apple = isApplePlatform()): boolean {
  const mod = apple ? e.metaKey : e.ctrlKey;
  // e.code keeps Alt/Option combos working on macOS, where Option changes e.key ("h" → "˙").
  const key = e.key.length === 1 && !e.altKey ? e.key.toLowerCase() : e.code.replace(/^Key|^Digit/, "").toLowerCase();
  return mod === combo.mod && e.shiftKey === combo.shift && e.altKey === combo.alt && key === combo.key;
}

/** Display form for <Kbd>: "⌘S" on Apple platforms, "Ctrl+S" elsewhere. */
export function formatHotkey(combo: string, apple = isApplePlatform()): string {
  const { mod, shift, alt, key } = parseHotkey(combo);
  const k = key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1);
  if (apple) return `${mod ? "⌘" : ""}${alt ? "⌥" : ""}${shift ? "⇧" : ""}${k}`;
  return [mod && "Ctrl", alt && "Alt", shift && "Shift", k].filter(Boolean).join("+");
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName);
}

/**
 * Global keyboard shortcut. Ignored while typing in a field unless `allowInInputs` (use that for
 * combos with a modifier, like ⌘S, that never produce text).
 */
export function useHotkeys(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  { enabled = true, allowInInputs = false }: { enabled?: boolean; allowInInputs?: boolean } = {},
) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const parsed = parseHotkey(combo);
    const apple = isApplePlatform();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing) return;
      if (!allowInInputs && isTyping(e.target)) return;
      if (!matchesHotkey(e, parsed, apple)) return;
      e.preventDefault();
      handlerRef.current(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, enabled, allowInInputs]);
}
