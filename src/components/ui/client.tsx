"use client";

import type { ReactNode } from "react";
import { cn } from "./index";

export { Dialog, type DialogProps } from "./dialog";
export { ConfirmProvider, useConfirm, type ConfirmOptions } from "./confirm";
export { Tooltip } from "./tooltip";
export { Menu, MenuItem, MenuLink, MenuSeparator, MenuLabel } from "./menu";
export { Tabs, type TabItem } from "./tabs";
export { SegmentedControl } from "./segmented";

/** JSON fetch helper for route handlers; throws with the server's error message. */
export async function apiFetch<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issues = Array.isArray(data.issues) ? ` (${data.issues.join("; ")})` : "";
    throw new Error((data.error ?? `Request failed (${res.status})`) + issues);
  }
  return data as T;
}

/** Page-level or form-level message. Errors that need fixing belong next to their field instead. */
export function Notice({
  tone,
  children,
  action,
  className,
}: {
  tone: "ok" | "error" | "warn" | "info";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm",
        tone === "ok" && "border-ok/25 bg-ok-soft text-ok",
        tone === "error" && "border-risk/25 bg-risk-soft text-risk",
        tone === "warn" && "border-warn/25 bg-warn-soft text-warn",
        tone === "info" && "border-info/25 bg-info-soft text-info",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-60">{children}</div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}
