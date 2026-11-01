"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./index";
import { Dialog } from "./dialog";

export interface ConfirmOptions {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** "danger" for irreversible actions: red confirm button. */
  tone?: "danger" | "default";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Async replacement for `window.confirm()`. Only for serious, irreversible actions; the safe
 * action takes focus first (NN/g, "Confirmation Dialogs Can Prevent User Errors").
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  // Options outlive `open` so the dialog keeps its text while it animates out.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function finish(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onClose={() => finish(false)}
        size="sm"
        title={options?.title}
        footer={
          <>
            <Button variant="secondary" data-autofocus onClick={() => finish(false)}>
              {options?.cancelLabel ?? t("cancel")}
            </Button>
            <Button variant={options?.tone === "danger" ? "danger" : "primary"} onClick={() => finish(true)}>
              {options?.confirmLabel ?? t("delete")}
            </Button>
          </>
        }
      >
        {options?.body && <div className="text-sm text-muted">{options.body}</div>}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** `const confirm = useConfirm(); if (!(await confirm({ title, tone: "danger" }))) return;` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return ctx ?? (async (o) => window.confirm(typeof o.title === "string" ? o.title : ""));
}
