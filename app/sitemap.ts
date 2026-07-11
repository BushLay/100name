import type { MetadataRoute } from "next"
import { getSitemapEntries } from "@/lib/seo-routes"

export default function sitemap(): MetadataRoute.Sitemap {
  return getSitemapEntries()
}
