import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
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

// Only enable Sentry upload if DSN is configured. Without this guard,
// every local build tries to call Sentry and warns loudly.
const sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      // Silence source-map upload unless SENTRY_AUTH_TOKEN is set in CI/Vercel
      silent: true,
      tunnelRoute: "/monitoring",
      hideSourceMaps: true,
      disableLogger: true,
    })
  : nextConfig;
