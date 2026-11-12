import type { MetadataRoute } from "next";
import { assetPath, assets, categories, siteConfig, subcategories } from "@/data/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = ["", "/browse", "/categories", "/pricing", "/roadmap"].map(
    (path) => ({
      url: `${siteConfig.url}${path || "/"}`,
      lastModified: now,
      changeFrequency: path === "" || path === "/browse" ? "daily" : "weekly",
      priority: path === "" ? 1 : 0.8,
    }),
  );

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${siteConfig.url}/browse?category=${c.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const subcategoryRoutes: MetadataRoute.Sitemap = subcategories.map((s) => ({
    url: `${siteConfig.url}/browse?category=${s.parentId}&subcategory=${s.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.65,
  }));

  const assetRoutes: MetadataRoute.Sitemap = assets.map((a) => ({
    url: `${siteConfig.url}${assetPath(a)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...subcategoryRoutes, ...assetRoutes];
}
