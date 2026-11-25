"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChevronsUpDown,
  Grid3x3,
  LayoutDashboard,
  Library,
  LogOut,
  Menu as MenuIcon,
  Radar,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { Button, Kbd, cn } from "@/components/ui";
import { BrandLogo, BrandMark } from "@/components/BrandMark";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/client";
import { PreferencesDialog } from "@/components/PreferencesDialog";
import { useHotkeyLabel, useHotkeys } from "@/lib/hooks/useHotkeys";

// The palette (and cmdk) load on first use, not with every page.
const CommandPalette = dynamic(() => import("@/components/CommandPalette").then((m) => m.CommandPalette), { ssr: false });

const ICONS = {
  layout: LayoutDashboard,
  book: BookOpen,
  library: Library,
  calendar: CalendarDays,
  users: Users,
  radar: Radar,
  alert: AlertTriangle,
  grid: Grid3x3,
};

export interface NavSection {
  title: string;
  items: { href: string; label: string; icon: keyof typeof ICONS; count?: number }[];
}

interface ShellUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

function initials(name: string) {
  const words = name.split(/\s+/).filter((w) => w && !w.endsWith(".") && !w.endsWith(","));
  return (words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "");
}

export function AppShell({ user, sections, children }: { user: ShellUser; sections: NavSection[]; children: ReactNode }) {
  const t = useTranslations("shell");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteLoaded, setPaletteLoaded] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const searchKey = useHotkeyLabel("mod+k");

  function openPalette() {
    setPaletteLoaded(true);
    setPaletteOpen(true);
    if (drawerRef.current?.open) drawerRef.current.close();
  }
  useHotkeys("mod+k", openPalette, { allowInInputs: true });

  function logout() {
    startSignOut(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    });
  }

  // Swipe left on the drawer to close it. The drawer follows the finger (unless reduced motion is
  // on); releasing past a third of its width, or a quick flick, closes it.
  const swipe = useRef<{ x: number; y: number; t: number; dx: number; horizontal: boolean | null } | null>(null);
  function onDrawerPointerDown(e: React.PointerEvent<HTMLDialogElement>) {
    if (e.pointerType !== "touch") return;
    swipe.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, horizontal: null };
  }
  function onDrawerPointerMove(e: React.PointerEvent<HTMLDialogElement>) {
    const s = swipe.current;
    const el = drawerRef.current;
    if (!s || !el) return;
    const dx = e.clientX - s.x;
    if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(e.clientY - s.y) > 8)) s.horizontal = Math.abs(dx) > Math.abs(e.clientY - s.y);
    if (!s.horizontal) return;
    s.dx = Math.min(0, dx);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transition = "none";
      el.style.translate = `${s.dx}px 0`;
    }
  }
  function onDrawerPointerEnd(e: React.PointerEvent<HTMLDialogElement>) {
    const s = swipe.current;
    const el = drawerRef.current;
    swipe.current = null;
    if (!s || !el) return;
    el.style.transition = "";
    el.style.translate = "";
    const fast = s.dx < -30 && e.timeStamp - s.t < 250;
    if (s.horizontal && (s.dx < -el.offsetWidth / 3 || fast)) el.close();
  }

  // Close the mobile drawer whenever navigation lands on a new page.
  useEffect(() => {
    if (drawerRef.current?.open) drawerRef.current.close();
  }, [pathname]);

  const openPrefs = () => setPrefsOpen(true);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only-focusable fixed top-2 left-2 z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium shadow-e2 focus-visible:outline-2 focus-visible:outline-brand"
      >
        {t("skipToContent")}
      </a>

      {/* Desktop header: a blue utility strip over a thick white banner with the logo and the main navigation. */}
      <header className="hidden lg:block">
        <div className="bg-header text-header-fg">
          <div className="mx-auto flex h-11 max-w-[85rem] items-center justify-end gap-3 px-10">
            <button
              type="button"
              onClick={openPalette}
              className="flex h-7 items-center gap-2 rounded-md bg-header-fg/10 px-2.5 text-xs hover:bg-header-fg/20 focus-visible:outline-2 focus-visible:outline-header-fg"
            >
              <Search className="size-3.5" aria-hidden />
              <span>{t("searchPlaceholder")}</span>
              <Kbd className="border-header-fg/30 bg-transparent text-header-fg">{searchKey}</Kbd>
            </button>
            <UserMenu variant="strip" user={user} onPreferences={openPrefs} onSignOut={logout} signingOut={signingOut} />
          </div>
        </div>
        <div className="border-b-[3px] border-accent bg-surface shadow-e1">
          <div className="mx-auto flex h-24 max-w-[85rem] items-stretch gap-8 px-10">
            <Link href={sections[0]?.items[0]?.href ?? "/"} className="flex shrink-0 items-center gap-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" aria-label={tc("appName")}>
              <BrandLogo className="h-[4.5rem]" />
              <span className="border-l border-border-strong pl-5 leading-tight">
                <span className="block text-lg font-bold text-brand">{tc("appName")}</span>
                <span className="block text-xs text-muted">{tc("registry")}</span>
              </span>
            </Link>
            <TopNav sections={sections} pathname={pathname} label={t("mainNav")} />
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-20 flex items-center gap-2 border-b-[3px] border-accent bg-header text-header-fg pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => drawerRef.current?.showModal()} aria-label={t("openMenu")} className="size-11 text-header-fg hover:bg-header-fg/10">
          <MenuIcon className="size-5!" />
        </Button>
        <span className="flex flex-1 items-center gap-2.5 py-2.5 text-sm font-bold"><BrandMark tone="onBrand" className="h-7" />{tc("appName")}</span>
        <Button variant="ghost" size="icon" onClick={openPalette} aria-label={t("searchShort")} className="size-11 text-header-fg hover:bg-header-fg/10">
          <Search className="size-5!" />
        </Button>
      </header>

      <dialog
        ref={drawerRef}
        aria-label={t("mainNav")}
        onClick={(e) => e.target === drawerRef.current && drawerRef.current.close()}
        onPointerDown={onDrawerPointerDown}
        onPointerMove={onDrawerPointerMove}
        onPointerUp={onDrawerPointerEnd}
        onPointerCancel={onDrawerPointerEnd}
        className="ui-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-72 max-w-[85vw] touch-pan-y border-r border-border bg-surface p-0 text-foreground shadow-e3 lg:hidden"
      >
        <div className="relative h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => drawerRef.current?.close()}
            aria-label={t("closeMenu")}
            className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] right-2 z-10 size-11 text-muted"
          >
            <X className="size-5!" />
          </Button>
          <SideNav user={user} sections={sections} pathname={pathname} onPreferences={openPrefs} onSearch={openPalette} onSignOut={logout} signingOut={signingOut} />
        </div>
      </dialog>

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      <PreferencesDialog open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      {paletteLoaded && (
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          userId={user.id}
          nav={sections.flatMap((s) => s.items.map((i) => ({ href: i.href, label: i.label, section: s.title })))}
          onPreferences={openPrefs}
          onSignOut={logout}
        />
      )}
    </div>
  );
}

function SideNav({
  user,
  sections,
  pathname,
  onPreferences,
  onSearch,
  onSignOut,
  signingOut,
}: {
  user: ShellUser;
  sections: NavSection[];
  pathname: string;
  onPreferences: () => void;
  onSearch: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const t = useTranslations();
  const searchKey = useHotkeyLabel("mod+k");
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  // Most specific matching nav item wins (so /lecturer/advisees doesn't also light up /lecturer).
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  // One indicator bar that slides to the active item (positioned on the DOM, no re-render).
  useLayoutEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    if (!list || !bar) return;
    const measure = () => {
      const link = list.querySelector<HTMLElement>('[aria-current="page"]');
      bar.style.opacity = link ? "1" : "0";
      if (link) {
        bar.style.translate = `0 ${link.offsetTop + 6}px`;
        bar.style.height = `${link.offsetHeight - 12}px`;
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    const frame = requestAnimationFrame(() => bar.setAttribute("data-ready", ""));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [activeHref]);

  return (
    <nav aria-label={t("shell.mainNav")} className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <BrandLogo className="h-14" />
        <div className="border-l border-border-strong pl-3 leading-tight">
          <div className="text-sm font-bold text-brand">{t("common.appName")}</div>
          <div className="text-[0.6875rem] text-muted">{t("common.registry")}</div>
        </div>
      </div>

      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand pointer-coarse:h-11"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">{t("shell.searchPlaceholder")}</span>
          <Kbd>{searchKey}</Kbd>
        </button>
      </div>

      <div ref={listRef} className="relative flex-1 space-y-5 overflow-y-auto px-2 py-2">
        <span
          ref={barRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-2 w-0.5 rounded-full bg-brand opacity-0 data-ready:transition-[translate,height] data-ready:duration-(--dur-2) data-ready:ease-(--ease-std) motion-reduce:transition-none"
        />
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{section.title}</div>
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm pointer-coarse:py-2.5",
                    "transition-colors duration-(--dur-1) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                    active ? "bg-brand-soft font-bold text-brand" : "text-foreground hover:bg-surface-2 hover:text-brand",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && <span className="text-xs text-muted tabular">{item.count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        <UserMenu user={user} onPreferences={onPreferences} onSignOut={onSignOut} signingOut={signingOut} />
      </div>
    </nav>
  );
}

function TopNav({ sections, pathname, label }: { sections: NavSection[]; pathname: string; label: string }) {
  const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label={label} className="ml-auto flex min-w-0 items-stretch overflow-x-auto">
      {sections.map((section) => (
        <ul key={section.title} aria-label={section.title} className="flex items-stretch border-l border-border">
          {section.items.map((item) => {
            const active = item.href === activeHref;
            return (
              <li key={item.href} className="flex">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 text-center text-[0.8125rem] leading-tight font-bold tracking-wide uppercase",
                    "transition-colors duration-(--dur-1) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                    active
                      ? "bg-brand-soft text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-brand"
                      : "text-foreground hover:bg-surface-2 hover:text-brand",
                  )}
                >
                  <span className="max-w-32">{item.label}</span>
                  {item.count !== undefined && <span className="rounded-full bg-brand-soft px-1.5 text-xs text-brand tabular">{item.count}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}

function UserMenu({
  user,
  onPreferences,
  onSignOut,
  signingOut,
  variant = "side",
}: {
  user: ShellUser;
  onPreferences: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  variant?: "side" | "strip";
}) {
  const t = useTranslations();
  const strip = variant === "strip";

  const roleList = user.roles.map((r) => (t.has(`roles.${r}`) ? t(`roles.${r}`) : r)).join(" · ");

  return (
    <Menu
      label={t("shell.accountMenu")}
      side={strip ? "bottom" : "top"}
      align={strip ? "end" : "start"}
      className="w-56"
      trigger={
        <button
          type="button"
          aria-busy={signingOut || undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md text-left focus-visible:outline-2 focus-visible:-outline-offset-2",
            strip
              ? "h-8 px-2 hover:bg-header-fg/10 focus-visible:outline-header-fg"
              : "w-full p-2 hover:bg-surface-2 focus-visible:outline-brand",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
              strip ? "size-6 bg-header-fg/20 text-header-fg" : "size-8 bg-brand-soft text-brand",
            )}
          >
            {initials(user.name)}
          </span>
          <span className={cn("leading-tight", strip ? "max-w-48" : "min-w-0 flex-1")}>
            <span className="block truncate text-sm font-medium">{user.name}</span>
            {!strip && <span className="block truncate text-xs text-muted">{roleList}</span>}
          </span>
          <ChevronsUpDown className={cn("size-4 shrink-0", strip ? "opacity-80" : "text-subtle")} aria-hidden />
        </button>
      }
    >
      <MenuLabel>
        <span className="block truncate">{user.email}</span>
      </MenuLabel>
      <MenuSeparator />
      <MenuItem onSelect={onPreferences}>
        <Settings2 aria-hidden />
        {t("shell.preferences")}…
      </MenuItem>
      <MenuItem onSelect={onSignOut} disabled={signingOut}>
        <LogOut aria-hidden />
        {signingOut ? t("shell.signingOut") : t("shell.signOut")}
      </MenuItem>
    </Menu>
  );
}
