"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme";

/**
 * Sonner styled with our tokens. Toasts are for passive confirmations only. Errors that need
 * fixing stay inline next to their source (NN/g, "Indicators, Validations, and Notifications").
 */
export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      gap={8}
      visibleToasts={4}
      closeButton
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--foreground)",
          "--success-bg": "var(--surface)",
          "--success-border": "var(--border)",
          "--success-text": "var(--foreground)",
          "--error-bg": "var(--risk-soft)",
          "--error-border": "color-mix(in oklab, var(--risk) 30%, transparent)",
          "--error-text": "var(--risk)",
          "--border-radius": "0.625rem",
          fontFamily: "var(--font-sans)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!shadow-e3 !text-sm !gap-2.5",
          description: "!text-muted",
          success: "[&_[data-icon]]:!text-ok",
          actionButton: "!bg-brand !text-brand-fg !font-medium",
        },
      }}
    />
  );
}
