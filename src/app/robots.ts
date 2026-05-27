import type { MetadataRoute } from "next";
import { getMetadataBase } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const { origin } = getMetadataBase();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
