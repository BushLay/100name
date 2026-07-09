const FALLBACK_SITE_URL = "https://example.com"

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (!configuredUrl) {
    return FALLBACK_SITE_URL
  }

  return trimTrailingSlash(configuredUrl)
}

export function getSiteMetadataBase() {
  return new URL(getSiteUrl())
}
