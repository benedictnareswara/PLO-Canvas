import Link from "next/link";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------- Button -------------------------------- */

const buttonVariants = {
  primary: "bg-brand text-brand-fg shadow-e1 hover:bg-brand-hover",
  secondary: "bg-surface text-foreground border border-border shadow-e1 hover:bg-surface-2 hover:border-border-strong",
  ghost: "text-foreground hover:bg-surface-2",
  danger: "bg-risk text-solid-fg shadow-e1 hover:bg-[color-mix(in_oklab,var(--risk),var(--foreground)_12%)]",
  "danger-ghost": "text-risk hover:bg-risk-soft",
};

const buttonSizes = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "size-9 text-sm",
  "icon-sm": "size-8 text-xs",
};

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "relative inline-flex shrink-0 select-none items-center justify-center rounded-lg font-medium whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,scale] duration-(--dur-1) ease-(--ease-out)",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    buttonSizes[size],
    buttonVariants[variant],
    className,
  );
}

/**
 * Loading keeps the label (no layout shift), adds a spinner and aria-busy, and disables the button
 * (Vercel Web Interface Guidelines). The spinner fades in after 200ms so fast saves never flash it.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="ui-spinner ui-delayed" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* --------------------------------- Card --------------------------------- */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-surface shadow-e1", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0 flex-1 basis-64">
        <h2 id={id} className="text-[0.9375rem] font-semibold leading-6">
          {title}
        </h2>
        {description && <p className="mt-0.5 max-w-prose text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/* --------------------------------- Badge -------------------------------- */

const badgeTones = {
  neutral: "bg-surface-2 text-muted border-border",
  ok: "bg-ok-soft text-ok border-[color-mix(in_oklab,var(--ok)_22%,transparent)]",
  risk: "bg-risk-soft text-risk border-[color-mix(in_oklab,var(--risk)_25%,transparent)]",
  warn: "bg-warn-soft text-warn border-[color-mix(in_oklab,var(--warn)_25%,transparent)]",
  brand: "bg-brand-soft text-brand border-[color-mix(in_oklab,var(--brand)_20%,transparent)]",
  info: "bg-info-soft text-info border-[color-mix(in_oklab,var(--info)_22%,transparent)]",
};

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-xs font-medium leading-5 [&_svg]:size-3",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------------- Forms -------------------------------- */

export const inputClass = cn(
  "h-9 w-full min-w-0 rounded-lg border border-border-input bg-surface px-3 text-sm shadow-e1 outline-none",
  "placeholder:text-subtle",
  "transition-[border-color,box-shadow] duration-(--dur-1)",
  "hover:border-foreground/40",
  "focus:border-brand focus:ring-3 focus:ring-[color-mix(in_oklab,var(--brand)_18%,transparent)]",
  "disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-11",
  "aria-invalid:border-risk aria-invalid:focus:ring-[color-mix(in_oklab,var(--risk)_18%,transparent)]",
  "user-invalid:border-risk",
);

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input className={cn(inputClass, className)} aria-invalid={invalid || undefined} {...props} />;
}

/**
 * Text input for scores and percentages: `inputmode="decimal"` (not type=number, so the
 * scroll wheel can't change values and "85,5" can be typed), right-aligned tabular figures.
 */
export function NumberInput({ className, invalid, ...props }: Omit<ComponentProps<"input">, "type"> & { invalid?: boolean }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      className={cn(inputClass, "text-right tabular", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "w-auto cursor-pointer pr-8 pl-2.5", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-muted", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="-mt-1 mb-1.5 text-xs text-subtle">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs font-medium text-risk">
          {error}
        </p>
      )}
    </div>
  );
}

/* --------------------------------- Table -------------------------------- */

/**
 * Semantic table in a keyboard-scrollable region (tabindex + role=region + label, per the
 * responsive-table guidance). Pass `maxHeight` to make the header stick while scrolling.
 */
export function Table({
  className,
  label,
  maxHeight,
  wrapperClassName,
  ...props
}: ComponentProps<"table"> & { label?: string; maxHeight?: string; wrapperClassName?: string }) {
  return (
    <div
      className={cn("ui-scroll-x", maxHeight && "overflow-y-auto", wrapperClassName)}
      style={maxHeight ? { maxHeight } : undefined}
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
    >
      <table className={cn("w-full border-separate border-spacing-0 text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-border bg-surface-2 px-3 py-2 text-left text-xs font-medium text-muted",
        "first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-border px-3 py-2.5 align-middle first:pl-5 last:pr-5", className)} {...props} />;
}

/* ------------------------------ Page chrome ----------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1 basis-80">
        {eyebrow && <div className="mb-1 text-xs font-medium text-muted">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-pretty sm:text-2xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Breadcrumbs({ items, label = "Breadcrumb" }: { items: { href?: string; label: ReactNode }[]; label?: string }) {
  return (
    <nav aria-label={label} className="mb-3 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="truncate rounded px-0.5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand">
                  {item.label}
                </Link>
              ) : (
                <span className={cn("truncate", last && "text-foreground")} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 shrink-0 text-subtle" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Empty states explain why something is empty and offer one next step
 * (NN/g, "Designing Empty States in Complex Applications").
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-border-strong px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted [&_svg]:size-5">{icon}</div>}
      {title && <div className="text-sm font-semibold">{title}</div>}
      {(description || children) && <div className="mt-1 max-w-md text-sm text-muted">{description ?? children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------ Data display ---------------------------- */

/** Kept for backwards compatibility; prefer SummaryStrip for groups of figures. */
export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "risk" | "ok" }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular", tone === "risk" && "text-risk", tone === "ok" && "text-ok")}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export interface SummaryItem {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "risk" | "ok" | "warn";
  icon?: ReactNode;
}

/**
 * One surface with dividers instead of a wall of identical KPI cards: figures read as a
 * single summary line, and hierarchy comes from weight and colour rather than boxes.
 */
export function SummaryStrip({ items, className }: { items: SummaryItem[]; className?: string }) {
  return (
    <Card className={cn("mb-6 grid grid-cols-2 overflow-hidden", items.length >= 4 ? "lg:grid-cols-4" : "sm:grid-cols-3", className)}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "min-w-0 border-border px-4 py-3.5 sm:px-5",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t",
            items.length >= 4 ? "lg:border-t-0 lg:[&:not(:first-child)]:border-l" : "sm:border-t-0 sm:[&:not(:first-child)]:border-l",
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted [&_svg]:size-3.5">
            {item.icon}
            {item.label}
          </div>
          <div
            className={cn(
              "mt-1 text-xl font-semibold tracking-tight tabular sm:text-2xl",
              item.tone === "risk" && "text-risk",
              item.tone === "ok" && "text-ok",
              item.tone === "warn" && "text-warn",
            )}
          >
            {item.value}
          </div>
          {item.hint && <div className="mt-0.5 truncate text-xs text-muted">{item.hint}</div>}
        </div>
      ))}
    </Card>
  );
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-sans text-[0.6875rem] font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <Loader2 className={cn("ui-spinner size-4 text-muted", className)} aria-hidden />
      {label && <span className="text-sm text-muted">{label}</span>}
    </span>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("ui-skeleton h-4", className)} {...props} />;
}

/** A thin horizontal meter (e.g. attainment against target), never colour-only: value is in text nearby. */
export function Meter({
  value,
  target,
  tone,
  className,
  label,
}: {
  value: number | null;
  target?: number;
  tone?: "ok" | "risk" | "brand";
  className?: string;
  label?: string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("relative h-1.5 w-full rounded-full bg-surface-2", className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-(--dur-3) ease-(--ease-out)",
          tone === "risk" ? "bg-risk" : tone === "ok" ? "bg-ok" : "bg-brand",
        )}
        style={{ width: `${pct}%` }}
      />
      {target !== undefined && (
        <div className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/60" style={{ left: `calc(${target}% - 1px)` }} aria-hidden />
      )}
    </div>
  );
}
