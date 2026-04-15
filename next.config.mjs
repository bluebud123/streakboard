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

// Always wrap with Sentry — the SDK itself no-ops at runtime if
// NEXT_PUBLIC_SENTRY_DSN isn't set (handled in instrumentation-client.ts).
export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
});
