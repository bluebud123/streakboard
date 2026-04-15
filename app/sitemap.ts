import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://streakboard.tohimher.com";

export const revalidate = 3600; // regenerate at most once per hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static, always-indexable pages
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/discover`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/support`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Fail open: if the DB hiccups during build, still serve a valid sitemap
  // with at least the static entries.
  try {
    const [profiles, projects] = await Promise.all([
      prisma.user.findMany({
        where: { isPublic: true },
        select: { username: true, createdAt: true },
        take: 5000,
      }),
      prisma.checklist.findMany({
        where: {
          visibility: { in: ["PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"] },
          slug: { not: null },
        },
        select: { slug: true, createdAt: true },
        take: 5000,
      }),
    ]);

    const profileEntries: MetadataRoute.Sitemap = profiles.map((u) => ({
      url: `${siteUrl}/u/${u.username}`,
      lastModified: u.createdAt,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    const projectEntries: MetadataRoute.Sitemap = projects.map((p) => ({
      url: `${siteUrl}/project/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticEntries, ...profileEntries, ...projectEntries];
  } catch {
    return staticEntries;
  }
}
