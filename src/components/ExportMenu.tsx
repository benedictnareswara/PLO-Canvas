"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button, type ButtonSize } from "@/components/ui";
import { Menu, MenuItem } from "@/components/ui/client";

export interface ExportItem {
  key: string;
  label: string;
  format: "csv" | "xlsx";
  run: () => void | Promise<void>;
}

/**
 * Export button with a format menu. CSV downloads at once; Excel loads its writer on demand, so it
 * shows a progress toast (a passive confirmation; failures say what to do next).
 */
export function ExportMenu({ items, size = "md", label }: { items: ExportItem[]; size?: ButtonSize; label?: string }) {
  const t = useTranslations("export");

  function run(item: ExportItem) {
    if (item.format === "csv") {
      try {
        void item.run();
      } catch {
        toast.error(t("failed"));
      }
      return;
    }
    toast.promise(Promise.resolve().then(item.run), { loading: t("preparing"), success: t("ready"), error: t("failed") });
  }

  return (
    <Menu
      label={label ?? t("menu")}
      align="end"
      trigger={
        <Button variant="secondary" size={size}>
          <Download aria-hidden /> {label ?? t("button")}
          <ChevronDown aria-hidden className="-mr-1 text-muted" />
        </Button>
      }
    >
      {items.map((item) => (
        <MenuItem key={item.key} onSelect={() => run(item)}>
          {item.format === "csv" ? <FileText aria-hidden /> : <FileSpreadsheet aria-hidden />}
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
