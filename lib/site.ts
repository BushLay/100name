export const CANONICAL_SITE_URL = "https://www.100names.top"
const FALLBACK_SITE_URL = CANONICAL_SITE_URL

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
  return new URL(CANONICAL_SITE_URL)
}

export function getCanonicalSiteUrl() {
  return CANONICAL_SITE_URL
}

export function buildCanonicalUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${CANONICAL_SITE_URL}${normalizedPath === "/" ? "/" : normalizedPath}`
}
