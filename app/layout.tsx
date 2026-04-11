import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import SiteFooter from "@/components/SiteFooter";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Streakboard — Track your learning. Share your streak.",
  description:
    "Build daily study habits and share your progress publicly — like GitHub, for your goals.",
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
