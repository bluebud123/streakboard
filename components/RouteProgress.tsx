"use client";

// Top progress bar that animates during client-side navigation.
//
// Why not a library: next.js doesn't expose a router-event API in the App
// Router. We patch <Link> clicks and window beforeunload by listening to
// pathname changes — when pathname changes, we finish; when a link is
// clicked, we start. Simple, zero deps.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0); // 0 = hidden, 1..99 = active, 100 = finishing

  // Animate up to 90% while we wait, then jump to 100 on pathname change.
  useEffect(() => {
    if (progress === 0 || progress >= 100) return;
    const id = setTimeout(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        // Slow down as we approach 90%
        const delta = p < 30 ? 8 : p < 60 ? 4 : 2;
        return Math.min(90, p + delta);
      });
    }, 120);
    return () => clearTimeout(id);
  }, [progress]);

  // When pathname changes, finish the bar.
  useEffect(() => {
    if (progress > 0 && progress < 100) {
      setProgress(100);
      const id = setTimeout(() => setProgress(0), 280);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Intercept <a>/<Link> clicks to start the bar. We only start if the link
  // points to a different path on the same origin and is not modified-click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as HTMLElement).closest("a");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href) return;
      if (el.target && el.target !== "" && el.target !== "_self") return;
      // External / anchors / mailto / tel — skip
      if (!href.startsWith("/") || href.startsWith("//")) return;
      // Same path — skip
      try {
        const url = new URL(href, window.location.href);
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      setProgress(10);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (progress === 0) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[60] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.9)] transition-[width] ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "200ms" : "300ms",
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
