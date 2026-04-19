import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import SiteFooter from "@/components/SiteFooter";
import MobileBottomNav from "@/components/MobileBottomNav";
import RouteProgress from "@/components/RouteProgress";
import { Toaster } from "sonner";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://streakboard.tohimher.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Streakboard — Track your learning. Share your streak.",
    template: "%s — Streakboard",
  },
  description:
    "Build daily study habits and share your progress publicly — like GitHub contributions, for your goals.",
  openGraph: {
    type: "website",
    siteName: "Streakboard",
    title: "Streakboard — Track your learning. Share your streak.",
    description:
      "Build daily study habits and share your progress publicly — like GitHub contributions, for your goals.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Streakboard — Track your learning. Share your streak.",
    description:
      "Build daily study habits and share your progress publicly — like GitHub contributions, for your goals.",
  },
  verification: {
    google: "QYDHNtt_lM0CVDs86HR4SNmT4T98iYRXqR-4gGT7QdY",
  },
  // Explicit icon wiring for PWA/iOS. The file-based icons (app/icon.tsx) were
  // removed because @vercel/og fails to build on Windows; we ship the SVG
  // directly and let Safari render it for apple-touch-icon.
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <SessionProvider>
          <RouteProgress />
          <div className="flex-1 flex flex-col">{children}</div>
          <MobileBottomNav />
        </SessionProvider>
        <SiteFooter />
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
