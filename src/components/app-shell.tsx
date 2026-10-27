"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  BookOpen,
  FolderKanban,
  BriefcaseBusiness,
  Heart,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/learning", label: "Learning", icon: BookOpen },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/habits", label: "Habits", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];
export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [more, setMore] = useState(false);
  function navLink(item: (typeof links)[number], compact = false) {
    const Icon = item.icon;
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={compact ? item.label : undefined}
        onClick={() => setMore(false)}
        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 ${active ? "bg-accent/15 text-accent-hover" : "text-muted hover:bg-elevated hover:text-foreground"}`}
      >
        <Icon size={18} />
        <span className={compact ? "sr-only" : ""}>{item.label}</span>
      </Link>
    );
  }
  return (
    <div className="min-h-dvh md:flex">
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface/40 p-3 md:flex ${collapsed ? "w-20" : "w-52"}`}
      >
        <div className="flex h-16 items-center gap-3 px-3">
          <Moon size={22} className="shrink-0 text-accent-hover" />
          {!collapsed && (
            <span className="font-semibold tracking-tight">
              Planner
              <span className="block text-[10px] font-normal uppercase tracking-[.16em] text-muted">
                Midnight Focus
              </span>
            </span>
          )}
        </div>
        <nav aria-label="Main navigation" className="mt-7 space-y-1">
          {links.map((item) => navLink(item, collapsed))}
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          <Button
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <>
                <PanelLeftClose size={18} />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-11 items-center justify-between border-b border-border px-5 text-xs text-muted md:px-8">
          <span className="flex items-center gap-2">
            <Moon size={16} className="text-accent-hover md:hidden" />
            Personal workspace <span className="mx-2 text-border">/</span>
            <span className="text-foreground">
              {links.find((l) => l.href === pathname)?.label ?? "Planner"}
            </span>
          </span>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`mx-auto max-w-[1600px] px-4 pb-52 md:pb-32 ${pathname === "/" ? "pt-3 md:px-4" : "pt-6 md:px-7 lg:px-9"}`}
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {[links[0], links[1], links[4]].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] ${pathname === item.href ? "text-accent-hover" : "text-muted"}`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMore(true)}
          className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] text-muted"
        >
          <MoreHorizontal size={20} />
          More
        </button>
      </nav>
      <Dialog
        open={more}
        onOpenChange={setMore}
        title="Your workspace"
        description="Open another part of your planner."
      >
        <nav aria-label="More navigation" className="space-y-2">
          {links.map((item) => navLink(item))}
        </nav>
      </Dialog>
    </div>
  );
}
