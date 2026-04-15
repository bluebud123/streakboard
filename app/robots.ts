import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://streakboard.tohimher.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/discover", "/u/", "/project/"],
        disallow: [
          "/api/",
          "/dashboard",
          "/settings",
          "/login",
          "/signup",
          "/verify-email",
          "/logs",
          "/guest",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
