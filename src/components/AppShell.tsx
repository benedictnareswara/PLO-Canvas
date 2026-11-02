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
  GraduationCap,
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

  // Close the mobile drawer whenever navigation lands on a new page.
  useEffect(() => {
    if (drawerRef.current?.open) drawerRef.current.close();
  }, [pathname]);

  const openPrefs = () => setPrefsOpen(true);

  return (
    <div className="min-h-dvh lg:flex [--app-sticky-top:calc(3.25rem+env(safe-area-inset-top))] lg:[--app-sticky-top:0px]">
      <a
        href="#main"
        className="sr-only-focusable fixed top-2 left-2 z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium shadow-e2 focus-visible:outline-2 focus-visible:outline-brand"
      >
        {t("skipToContent")}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface lg:block">
        <SideNav user={user} sections={sections} pathname={pathname} onPreferences={openPrefs} onSearch={openPalette} onSignOut={logout} signingOut={signingOut} />
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => drawerRef.current?.showModal()} aria-label={t("openMenu")} className="size-11">
          <MenuIcon className="size-5!" />
        </Button>
        <span className="flex-1 py-3 text-sm font-semibold">{tc("appName")}</span>
        <Button variant="ghost" size="icon" onClick={openPalette} aria-label={t("searchShort")} className="size-11">
          <Search className="size-5!" />
        </Button>
      </header>

      <dialog
        ref={drawerRef}
        aria-label={t("mainNav")}
        onClick={(e) => e.target === drawerRef.current && drawerRef.current.close()}
        className="ui-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-border bg-surface p-0 text-foreground shadow-e3 lg:hidden"
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

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
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
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-fg">
          <GraduationCap className="size-4" aria-hidden />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{t("common.appName")}</div>
          <div className="text-[0.6875rem] text-muted">{t("common.university")}</div>
        </div>
      </div>

      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-2.5 text-sm text-muted hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand pointer-coarse:h-11"
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
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm pointer-coarse:py-2.5",
                    "transition-colors duration-(--dur-1) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                    active ? "bg-brand-soft font-medium text-brand" : "text-foreground hover:bg-surface-2",
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

function UserMenu({
  user,
  onPreferences,
  onSignOut,
  signingOut,
}: {
  user: ShellUser;
  onPreferences: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const t = useTranslations();

  const roleList = user.roles.map((r) => (t.has(`roles.${r}`) ? t(`roles.${r}`) : r)).join(" · ");

  return (
    <Menu
      label={t("shell.accountMenu")}
      side="top"
      align="start"
      className="w-56"
      trigger={
        <button
          type="button"
          aria-busy={signingOut || undefined}
          className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand uppercase"
          >
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted">{roleList}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
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
