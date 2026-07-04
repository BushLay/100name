import type { MetadataRoute } from "next"

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
