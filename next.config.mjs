import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep rendered pages in the App Router client cache long enough that
    // /dashboard ↔ /logs round-trips feel instant on back-forward nav.
    // Without this, Next 14 treats every dynamic page as fresh (0s) and
    // re-renders on the server every time — the main cause of perceived
    // lag when switching tabs.
    staleTimes: {
      dynamic: 60,  // seconds — cached RSC payload for dynamic routes
      static: 300,
    },
  },
  async redirects() {
    return [
      {
        source: "/checklist/:slug",
        destination: "/project/:slug",
        permanent: true,
      },
    ];
  },
};

// Always wrap with Sentry — the SDK itself no-ops at runtime if
// NEXT_PUBLIC_SENTRY_DSN isn't set (handled in instrumentation-client.ts).
export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
});
