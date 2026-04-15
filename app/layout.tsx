import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import SiteFooter from "@/components/SiteFooter";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
        <SessionProvider>
          <div className="flex-1 flex flex-col">{children}</div>
        </SessionProvider>
        <SiteFooter />
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
