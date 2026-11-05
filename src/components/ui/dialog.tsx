"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button, cn } from "./index";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Unsaved edits: Esc, the close button and backdrop clicks ask before discarding. */
  dirty?: boolean;
  /** "any" also closes on a backdrop click; "closerequest" (default) only on Esc or the close button. */
  closedby?: "any" | "closerequest";
  /** "sheet" docks to the bottom edge on small screens. */
  variant?: "dialog" | "sheet";
}

/**
 * Native modal <dialog>. Enter/exit motion lives in globals.css (`.ui-dialog`); content stays mounted
 * until the exit transition ends. Put `data-autofocus` on the element that should take focus first
 * (for example the safe action of a confirmation).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dirty = false,
  closedby = "closerequest",
  variant = "dialog",
}: DialogProps) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(open);
  const [confirming, setConfirming] = useState(false);
  if (open && !mounted) setMounted(true);
  if (!open && confirming) setConfirming(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && el.open) {
      el.close();
      const timer = window.setTimeout(() => setMounted(false), 300);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  function requestClose() {
    if (dirty) setConfirming(true);
    else onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        // The content fills the dialog box, so a click whose target is the dialog itself hit the backdrop.
        if (closedby === "any" && e.target === ref.current) requestClose();
      }}
      aria-labelledby={mounted ? titleId : undefined}
      className={cn(
        "ui-dialog m-auto max-h-[92vh] w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-0 text-foreground shadow-e3",
        variant === "sheet" && "ui-sheet",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-3xl",
        size === "xl" && "max-w-6xl",
      )}
    >
      {(open || mounted) && (
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold leading-6">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={requestClose} aria-label={t("common.close")} className="-mr-1.5 -mt-0.5 text-muted">
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {confirming ? (
            <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-warn-soft px-5 py-3">
              <div className="min-w-0 flex-1 basis-48 text-sm">
                <div className="font-medium">{t("confirm.discardTitle")}</div>
                <div className="text-muted">{t("confirm.discardBody")}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" autoFocus onClick={() => setConfirming(false)}>
                  {t("confirm.keepEditing")}
                </Button>
                <Button variant="danger" onClick={onClose}>
                  {t("confirm.discardAction")}
                </Button>
              </div>
            </div>
          ) : (
            footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
