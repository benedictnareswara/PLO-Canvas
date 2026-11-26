import Image from "next/image";
import { cn } from "@/components/ui";

/**
 * American University of Indonesia logo. Two colour sets because the navy and crimson disappear on
 * dark surfaces: the dark set lifts them to periwinkle and pink. `dark:` follows the app's resolved
 * theme, so the swap matches the rest of the UI. `onBrand` always uses the light-on-navy set (login
 * panel, blue header strip, course-card banners).
 */
type Tone = "auto" | "onBrand";

// Shows one logo. In "auto" mode it draws two images, a light one and a dark one, and CSS hides
// the wrong one depending on the theme. That way the logo is always readable.
function Pair({ light, dark, ratio, className, label, tone, sizes }: { light: string; dark: string; ratio: string; className?: string; label?: string; tone: Tone; sizes: string }) {
  const alt = label ?? "";
  return (
    <span className={cn("relative inline-block shrink-0", ratio, className)}>
      {tone === "auto" ? (
        <>
          <Image src={light} alt={alt} fill sizes={sizes} className="object-contain dark:hidden" priority />
          <Image src={dark} alt={alt} fill sizes={sizes} className="hidden object-contain dark:block" priority />
        </>
      ) : (
        <Image src={dark} alt={alt} fill sizes={sizes} className="object-contain" priority />
      )}
    </span>
  );
}

/** The starburst on its own, for tight spots. */
export function BrandMark({ className, label, tone = "auto" }: { className?: string; label?: string; tone?: Tone }) {
  return <Pair light="/brand/aui-mark.png" dark="/brand/aui-mark-dark.png" ratio="aspect-[240/376]" className={className} label={label} tone={tone} sizes="64px" />;
}

/** Starburst plus "The American University of Indonesia" wordmark. */
export function BrandLogo({ className, label, tone = "auto" }: { className?: string; label?: string; tone?: Tone }) {
  return <Pair light="/brand/aui-logo.png" dark="/brand/aui-logo-dark.png" ratio="aspect-[640/282]" className={className} label={label} tone={tone} sizes="320px" />;
}
