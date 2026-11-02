"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Command } from "cmdk";
import { ArrowRight, BookOpen, Clock, GraduationCap, Languages, Library, LogOut, Monitor, Moon, Search, Settings2, Sun, type LucideIcon } from "lucide-react";
import { Kbd, Spinner } from "@/components/ui";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { changeLocale } from "@/lib/locale-client";
import { setThemeMode } from "@/lib/theme";
import type { SearchResults } from "@/lib/search/types";

export interface PaletteNavItem {
  href: string;
  label: string;
  section: string;
}

interface Recent {
  href: string;
  label: string;
  kind: "student" | "class" | "course" | "page";
}

const RECENT_LIMIT = 6;
const recentKey = (userId: string) => `palette-recent:${userId}`;

function readRecent(userId: string): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(userId: string, item: Recent) {
  try {
    const next = [item, ...readRecent(userId).filter((r) => r.href !== item.href)].slice(0, RECENT_LIMIT);
    localStorage.setItem(recentKey(userId), JSON.stringify(next));
  } catch {
    /* storage blocked: recents are a convenience */
  }
}

const KIND_ICON: Record<Recent["kind"], LucideIcon> = { student: GraduationCap, class: Library, course: BookOpen, page: Clock };

/**
 * ⌘/Ctrl+K palette: jump to pages, recent items, students and classes (searched on the server,
 * scoped to what you may open), plus theme, language, preferences and sign-out actions.
 * Opening is instant (no animation): it's used many times a day.
 */
export function CommandPalette({
  open,
  onClose,
  userId,
  nav,
  onPreferences,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  nav: PaletteNavItem[];
  onPreferences: () => void;
  onSignOut: () => void;
}) {
  const t = useTranslations("palette");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; data: SearchResults } | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const trimmed = query.trim();
  const searching = trimmed.length >= 2 && results?.q !== trimmed;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // autoFocus ran while the dialog was still closed; focus the field now that it's shown.
      el.querySelector<HTMLInputElement>("input")?.focus();
      setRecent(readRecent(userId));
    }
    if (!open && el.open) el.close();
  }, [open, userId]);

  // Debounced server search; stale responses are ignored by comparing the query they answer.
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (res.ok) setResults({ q: trimmed, data: await res.json() });
      } catch {
        /* aborted or offline: keep showing navigation */
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  function close() {
    setQuery("");
    onClose();
  }

  function go(item: Recent) {
    pushRecent(userId, item);
    close();
    router.push(item.href);
  }

  function run(action: () => void) {
    close();
    action();
  }

  const data = trimmed.length >= 2 && results?.q === trimmed ? results.data : null;

  // Server results arrive after cmdk has picked its first match (often an action); select the top
  // result once they land, so Enter opens what was searched for.
  const [selected, setSelected] = useState("");
  const [selectedFor, setSelectedFor] = useState<SearchResults | null>(null);
  if (data && data !== selectedFor) {
    setSelectedFor(data);
    const s = data.students[0];
    const c = data.classes[0];
    const k = data.courses[0];
    const top = s ? `${s.name} ${s.studentId ?? ""} ${s.id}` : c ? `${c.code} ${c.title} ${c.period} ${c.id}` : k ? `${k.code} ${k.title} ${k.id}` : null;
    if (top) setSelected(top);
  }
  const sections = [...new Set(nav.map((n) => n.section))];
  const nextLocale = LOCALES.find((l) => l !== locale) ?? "en";

  return (
    <dialog
      ref={ref}
      aria-label={t("label")}
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
      className="m-auto mt-[12vh] w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-e3 outline-none backdrop:bg-black/40"
    >
      {open && (
        <Command label={t("label")} loop value={selected} onValueChange={setSelected} className="flex max-h-[70vh] flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t("placeholder")}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle pointer-coarse:text-base"
            />
            {searching && <Spinner className="ui-delayed size-4" />}
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="min-h-0 flex-1 overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted">{searching ? t("searching") : t("empty")}</Command.Empty>

            {!trimmed && recent.length > 0 && (
              <Command.Group heading={t("recent")}>
                {recent.map((r) => {
                  const Icon = KIND_ICON[r.kind];
                  return (
                    <PaletteItem key={r.href} value={`recent ${r.label} ${r.href}`} onSelect={() => go(r)} icon={Icon}>
                      {r.label}
                    </PaletteItem>
                  );
                })}
              </Command.Group>
            )}

            {data && data.students.length > 0 && (
              <Command.Group heading={t("students")}>
                {data.students.map((s) => (
                  <PaletteItem
                    key={s.id}
                    // The searchable text decides ranking against pages and actions; the id keeps values unique.
                    value={`${s.name} ${s.studentId ?? ""} ${s.id}`}
                    forceMount
                    icon={GraduationCap}
                    onSelect={() => go({ href: `/students/${s.id}`, label: s.name, kind: "student" })}
                    hint={[s.studentId, s.cohortYear].filter(Boolean).join(" · ")}
                  >
                    {s.name}
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {data && data.classes.length > 0 && (
              <Command.Group heading={t("classes")}>
                {data.classes.map((c) => (
                  <PaletteItem
                    key={c.id}
                    value={`${c.code} ${c.title} ${c.period} ${c.id}`}
                    forceMount
                    icon={Library}
                    onSelect={() => go({ href: `/lecturer/offerings/${c.id}`, label: `${c.code} · ${c.period}`, kind: "class" })}
                    hint={c.period}
                  >
                    {c.code} · {c.title}
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {data && data.courses.length > 0 && (
              <Command.Group heading={t("courses")}>
                {data.courses.map((c) => (
                  <PaletteItem
                    key={c.id}
                    value={`${c.code} ${c.title} ${c.id}`}
                    forceMount
                    icon={BookOpen}
                    onSelect={() => go({ href: `/admin/courses?courses-q=${encodeURIComponent(c.code)}`, label: c.code, kind: "course" })}
                  >
                    {c.code} · {c.title}
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {sections.map((section) => (
              <Command.Group key={section} heading={section}>
                {nav
                  .filter((n) => n.section === section)
                  .map((n) => (
                    <PaletteItem key={n.href} value={`${n.label} ${section}`} icon={ArrowRight} onSelect={() => go({ href: n.href, label: n.label, kind: "page" })}>
                      {n.label}
                    </PaletteItem>
                  ))}
              </Command.Group>
            ))}

            <Command.Group heading={t("actions")}>
              <PaletteItem value={t("themeLight")} icon={Sun} onSelect={() => run(() => setThemeMode("light"))}>
                {t("themeLight")}
              </PaletteItem>
              <PaletteItem value={t("themeDark")} icon={Moon} onSelect={() => run(() => setThemeMode("dark"))}>
                {t("themeDark")}
              </PaletteItem>
              <PaletteItem value={t("themeSystem")} icon={Monitor} onSelect={() => run(() => setThemeMode("system"))}>
                {t("themeSystem")}
              </PaletteItem>
              <PaletteItem
                value={`${t("language")} ${LOCALE_LABELS[nextLocale]}`}
                icon={Languages}
                onSelect={() =>
                  run(async () => {
                    await changeLocale(nextLocale, { signedIn: true });
                    router.refresh();
                  })
                }
              >
                <span lang={nextLocale}>{t("switchLanguage", { language: LOCALE_LABELS[nextLocale] })}</span>
              </PaletteItem>
              <PaletteItem value={t("preferences")} icon={Settings2} onSelect={() => run(onPreferences)}>
                {t("preferences")}
              </PaletteItem>
              <PaletteItem value={t("signOut")} icon={LogOut} onSelect={() => run(onSignOut)}>
                {t("signOut")}
              </PaletteItem>
            </Command.Group>
          </Command.List>
          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {t("navigate")}
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> {t("open")}
            </span>
          </div>
        </Command>
      )}
    </dialog>
  );
}

function PaletteItem({
  value,
  onSelect,
  icon: Icon,
  hint,
  forceMount,
  children,
}: {
  value: string;
  onSelect: () => void;
  icon: LucideIcon;
  hint?: string;
  forceMount?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      forceMount={forceMount}
      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-brand-soft data-[selected=true]:text-brand pointer-coarse:py-3"
    >
      <Icon className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs text-muted tabular">{hint}</span>}
    </Command.Item>
  );
}
