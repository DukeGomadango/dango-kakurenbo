import type { MetadataRoute } from "next";
import { getMetadataBase } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const { origin } = getMetadataBase();

  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
