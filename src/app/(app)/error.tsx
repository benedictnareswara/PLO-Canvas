"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, ButtonLink, EmptyState } from "@/components/ui";

/** Errors inside the app shell: navigation stays usable; the user can retry or go home. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      className="mt-10"
      icon={<AlertTriangle />}
      title={<h1 className="text-base font-semibold">{t("genericTitle")}</h1>}
      description={
        <>
          <p>{t("genericBody")}</p>
          {error.digest && <p className="mt-2 font-mono text-xs text-subtle">{t("reference", { digest: error.digest })}</p>}
        </>
      }
      action={
        <>
          <Button onClick={reset}>
            <RotateCcw aria-hidden /> {t("tryAgain")}
          </Button>
          <ButtonLink href="/">{t("goHome")}</ButtonLink>
        </>
      }
    />
  );
}
