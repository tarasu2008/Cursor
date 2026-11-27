import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/catalog";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — HD Stock Photos & Wallpapers`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
