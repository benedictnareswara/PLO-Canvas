"use client";

import { useSyncExternalStore } from "react";
import { THEME_COLOR, THEME_STORAGE_KEY } from "./theme-colors";

export type ThemeMode = "system" | "light" | "dark";
const KEY = THEME_STORAGE_KEY;
const EVENT = "obe:theme-change";

/** Light is the default; "System" and "Dark" are choices stored in localStorage. */
function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  root.dataset.theme = mode;
  if (meta) meta.content = mode === "system" ? "light dark" : mode;
  // Browser chrome follows the resolved scheme.
  const scheme = mode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = THEME_COLOR[scheme];
  });
}

/** Three-state theme: light (default), dark, or follow the system. */
export function setThemeMode(mode: ThemeMode) {
  try {
    if (mode === "light") localStorage.removeItem(KEY);
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
  const snap = useSyncExternalStore(subscribe, snapshot, () => "light|light");
  const [mode, system] = snap.split("|") as [ThemeMode, "light" | "dark"];
  return { mode, system, resolved: mode === "system" ? system : mode };
}
