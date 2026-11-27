import type { MetadataRoute } from "next";
import { assetPath, assets, categories, siteConfig, subcategories } from "@/data/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", freq: "daily" as const, priority: 1.0 },
    { path: "/browse", freq: "daily" as const, priority: 0.9 },
    { path: "/categories", freq: "weekly" as const, priority: 0.9 },
    { path: "/pricing", freq: "weekly" as const, priority: 0.85 },
    { path: "/roadmap", freq: "monthly" as const, priority: 0.65 },
    { path: "/privacy", freq: "monthly" as const, priority: 0.4 },
    { path: "/terms", freq: "monthly" as const, priority: 0.4 },
  ].map(({ path, freq, priority }) => ({
    url: `${siteConfig.url}${path || "/"}`,
    lastModified: now,
    changeFrequency: freq,
    priority,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${siteConfig.url}/browse?category=${c.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  const subcategoryRoutes: MetadataRoute.Sitemap = subcategories.map((s) => ({
    // XML <loc> requires &amp; escaping for query separators in Next.js sitemap output
    url: `${siteConfig.url}/browse?category=${s.parentId}&amp;subcategory=${s.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const assetRoutes: MetadataRoute.Sitemap = assets.map((a) => ({
    url: `${siteConfig.url}${assetPath(a)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...subcategoryRoutes, ...assetRoutes];
}
