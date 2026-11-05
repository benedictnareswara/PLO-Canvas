"use client";

import { useSyncExternalStore } from "react";
import { THEME_COLOR, THEME_STORAGE_KEY } from "./theme-colors";

export type ThemeMode = "system" | "light" | "dark";
const KEY = THEME_STORAGE_KEY;
const EVENT = "obe:theme-change";

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (mode === "system") {
    delete root.dataset.theme;
    if (meta) meta.content = "light dark";
  } else {
    root.dataset.theme = mode;
    if (meta) meta.content = mode;
  }
  // Browser chrome: follow the override, or each meta's own media query when following the system.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = mode === "system" ? (m.media.includes("dark") ? "dark" : "light") : mode;
    m.content = THEME_COLOR[scheme];
  });
}

/** Three-state theme: "system" removes the stored override (per the dark-mode-toggle guidance). */
export function setThemeMode(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* storage blocked: still apply for this page */
  }
  apply(mode);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      apply(readStored());
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
    mq.removeEventListener("change", cb);
  };
}

function snapshot(): string {
  const mode = readStored();
  const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return `${mode}|${system}`;
}

/** Current mode, the OS scheme, and the resolved (rendered) scheme. */
export function useTheme(): { mode: ThemeMode; system: "light" | "dark"; resolved: "light" | "dark" } {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "system|light");
  const [mode, system] = snap.split("|") as [ThemeMode, "light" | "dark"];
  return { mode, system, resolved: mode === "system" ? system : mode };
}
