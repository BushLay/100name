import type { MetadataRoute } from "next"

import { getDailyRoute, getIndexableDailyDates } from "@/lib/daily"
import { getSiteUrl } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl()
  const dailyPages = getIndexableDailyDates().map((date) => ({
    url: `${baseUrl}${getDailyRoute(date)}`,
    lastModified: new Date(`${date}T00:00:00Z`),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/how-to-play`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.5,
    },
    ...dailyPages,
  ]
}
