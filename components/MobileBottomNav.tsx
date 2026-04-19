"use client";

// Fixed bottom nav for mobile (sm:hidden). Hidden on tablets & up — those use
// the AppHeader top nav. Only renders for signed-in users; logged-out users
// see the marketing CTA in AppHeader instead.
//
// Tap targets are 56px tall (above the iOS/Material 44–48px guideline). The
// app body has bottom padding (`pb-20 sm:pb-0`) added in layout.tsx so content
// isn't hidden behind the bar.

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Dashboard IS the project checklist view — that's the core of the app, so
// we label the tab "Projects" (with a checklist icon) rather than a generic
// "Home". Keeps the primary feature one tap away on mobile.
const items = [
  { href: "/dashboard", label: "Projects", icon: "📋" },
  { href: "/logs", label: "Log", icon: "📝" },
  { href: "/discover", label: "Explore", icon: "🌐" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function MobileBottomNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  if (!session?.user) return null;

  return (
    <nav
      aria-label="Primary"
      className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center justify-center gap-0.5 h-14 min-h-[56px] text-[10px] font-semibold transition-colors ${
                  active ? "text-amber-400" : "text-slate-500 hover:text-slate-200 active:text-amber-400"
                }`}
              >
                <span className="text-lg leading-none" aria-hidden>{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
