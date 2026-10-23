"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Grid3x3,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Radar,
  Users,
} from "lucide-react";
import { cn } from "@/components/ui";

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
  items: { href: string; label: string; icon: keyof typeof ICONS }[];
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  faculty_head: "Faculty Head",
  lecturer: "Lecturer",
  student: "Student",
};

export function AppShell({
  user,
  sections,
  children,
}: {
  user: { name: string; email: string; roles: string[] };
  sections: NavSection[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  // Most specific matching nav item wins (so /lecturer/advisees doesn't also light up /lecturer).
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-brand text-white">
          <GraduationCap className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">OBE Gradebook</div>
          <div className="text-[11px] text-muted">Sampoerna University</div>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{section.title}</div>
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                    active ? "bg-brand-soft font-medium text-brand" : "text-foreground hover:bg-background",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted">{user.email}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {user.roles.map((r) => (
            <span key={r} className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
        </div>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-background hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-surface lg:block">{nav}</aside>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded p-1 hover:bg-background">
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-semibold">OBE Gradebook</span>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface shadow-xl">{nav}</aside>
        </div>
      )}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
