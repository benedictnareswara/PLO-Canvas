"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Opens the browser's print dialog, where "Save as PDF" is also offered. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.print()}>
      <Printer aria-hidden /> {label}
    </Button>
  );
}
