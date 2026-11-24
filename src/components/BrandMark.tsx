import Image from "next/image";
import { cn } from "@/components/ui";

/**
 * Sampoerna University starburst mark. Two raster variants because the navy rays disappear on
 * dark surfaces: the dark-scheme file lifts them to periwinkle. `dark:` follows the app's
 * resolved theme (data-theme override or OS), so the swap matches the rest of the UI.
 */
export function BrandMark({ className, label }: { className?: string; label?: string }) {
  const alt = label ?? "";
  return (
    <span className={cn("relative inline-block aspect-[192/236] shrink-0", className)}>
      <Image src="/brand/su-mark.png" alt={alt} fill sizes="64px" className="object-contain dark:hidden" priority />
      <Image src="/brand/su-mark-dark.png" alt={alt} fill sizes="64px" className="hidden object-contain dark:block" priority />
    </span>
  );
}
