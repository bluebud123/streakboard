"use client";

// Mobile bottom tab bar shared between /dashboard and /logs so the nav
// stays identical as the user moves between those routes.
//
// Tabs:
//   home / projects / progress / calendar → dashboard sub-views
//   logs → full page at /logs
//
// Usage patterns:
//   • On /dashboard: `active` = local state key, `onTabChange` switches the
//     in-page view. The "logs" tab is a <Link> to /logs.
//   • On /logs: `active="logs"`, `onTabChange` omitted. The four dashboard
//     tabs are <Link>s to /dashboard?tab=X so clicking them routes back and
//     the dashboard initializes on the right sub-view.

import Link from "next/link";

export type TabKey = "home" | "projects" | "progress" | "calendar" | "logs";

interface Props {
  active: TabKey;
  /** When present, the 4 dashboard tabs fire this instead of navigating. */
  onTabChange?: (tab: Exclude<TabKey, "logs">) => void;
}

const TABS: Array<{ key: TabKey; icon: string; label: string }> = [
  { key: "home",     icon: "🏠", label: "Home" },
  { key: "projects", icon: "📋", label: "Projects" },
  { key: "progress", icon: "📊", label: "Progress" },
  { key: "calendar", icon: "📅", label: "Calendar" },
  { key: "logs",     icon: "📓", label: "Logs" },
];

export default function DashboardTabBar({ active, onTabChange }: Props) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 flex items-center pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const cls = `flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] transition-colors ${
          isActive ? "text-amber-400" : "text-slate-500 active:text-slate-300"
        }`;
        const labelCls = `text-[10px] font-semibold tracking-wide ${
          isActive ? "text-amber-400" : "text-slate-500"
        }`;

        // Logs is always a full-page link.
        if (t.key === "logs") {
          return (
            <Link key={t.key} href="/logs" className={cls}>
              <span className="text-xl leading-none">{t.icon}</span>
              <span className={labelCls}>{t.label}</span>
            </Link>
          );
        }

        // If onTabChange is provided, render as in-page tab button.
        if (onTabChange) {
          return (
            <button key={t.key} onClick={() => onTabChange(t.key as Exclude<TabKey, "logs">)} className={cls}>
              <span className="text-xl leading-none">{t.icon}</span>
              <span className={labelCls}>{t.label}</span>
            </button>
          );
        }

        // Otherwise (we're on /logs), route to dashboard with the tab as a
        // query param so dashboard initializes on the right sub-view.
        return (
          <Link key={t.key} href={`/dashboard?tab=${t.key}`} className={cls}>
            <span className="text-xl leading-none">{t.icon}</span>
            <span className={labelCls}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
