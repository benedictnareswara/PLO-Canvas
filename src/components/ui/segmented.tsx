"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./index";

/**
 * A small set of mutually exclusive options shown side by side. Built on native radio inputs,
 * so arrow keys, form semantics and screen-reader announcements come from the platform.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-border bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "relative flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap text-muted select-none",
            "transition-[background-color,color,box-shadow] duration-(--dur-1)",
            "hover:text-foreground has-checked:bg-surface has-checked:text-foreground has-checked:shadow-e1",
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-brand",
            "[&_svg]:size-4 pointer-coarse:min-h-11",
            size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.icon}
          {o.label}
        </label>
      ))}
    </div>
  );
}
