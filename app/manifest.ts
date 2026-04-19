import type { MetadataRoute } from "next";

// PWA manifest — makes the site installable on Android, iOS Home Screen,
// and desktop Chrome/Edge. Next.js auto-serves this at /manifest.webmanifest
// and wires the <link rel="manifest"> tag into <head>.
//
// We deliberately keep `display: "standalone"` so the installed app hides the
// URL bar and looks native. `orientation: "portrait"` matches phone-first UX.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Streakboard — Track your learning streak",
    short_name: "Streakboard",
    description:
      "Build daily study habits and share your progress publicly — like GitHub contributions, for your goals.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617", // matches bg-slate-950
    theme_color: "#f59e0b", // amber-500
    categories: ["productivity", "education", "lifestyle"],
    icons: [
      // SVG is accepted by Chromium (Android install prompt) and modern Safari.
      // We keep just this one entry to avoid needing binary PNG assets in the
      // repo. iOS Home Screen falls back to a screenshot of the page if no
      // apple-touch-icon is set — acceptable for v1.
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
