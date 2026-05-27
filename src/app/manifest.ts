import type { MetadataRoute } from "next";
import { siteMetadata } from "@/lib/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteMetadata.title,
    short_name: siteMetadata.name,
    description: siteMetadata.description,
    start_url: "/",
    display: "standalone",
    background_color: "#06050b",
    theme_color: "#8b5cf6",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
