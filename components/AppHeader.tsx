"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isSignedIn = !!session?.user;

  const navLink = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`text-sm transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-amber-400 after:transition-all after:duration-200 ${
          active ? "text-amber-400 after:w-full" : "text-slate-400 hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="border-b border-slate-800/60 px-6 py-4 flex items-center justify-between sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md transition-all duration-200">
      <Link
        href={isSignedIn ? "/dashboard" : "/"}
        className="text-xl font-bold text-amber-500 hover:text-amber-400 transition-colors tracking-tight"
      >
        Streakboard
      </Link>

      <nav className="flex items-center gap-5">
        {isSignedIn ? (
          <>
            {navLink("/dashboard", "Dashboard")}
            {navLink("/logs", "Log")}
            {navLink("/discover", "Explore")}
            {navLink("/settings", "Settings")}
          </>
        ) : (
          <>
            {navLink("/discover", "Explore")}
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
            >
              Sign up →
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
