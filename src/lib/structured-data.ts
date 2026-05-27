import { getMetadataBase, siteMetadata } from "@/lib/site-metadata";

export function getWebApplicationJsonLd() {
  const base = getMetadataBase();

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteMetadata.name,
    headline: siteMetadata.title,
    description: siteMetadata.description,
    url: base.origin,
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
    },
    inLanguage: "ja",
  };
}
