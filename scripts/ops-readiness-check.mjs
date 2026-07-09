import process from "node:process"

const baseUrl =
  process.env.NAME100_RELEASE_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  null
const adminSecret = process.env.NAME100_ADMIN_SECRET?.trim() || null

if (!baseUrl) {
  console.error("NAME100_RELEASE_BASE_URL or NEXT_PUBLIC_SITE_URL is required.")
  process.exit(1)
}

if (!adminSecret) {
  console.error("NAME100_ADMIN_SECRET is required.")
  process.exit(1)
}

const readinessUrl = new URL(`${baseUrl.replace(/\/$/, "")}/api/internal/readiness`)
readinessUrl.searchParams.set("record", "true")
readinessUrl.searchParams.set("reason", "scheduled readiness check")

const response = await fetch(readinessUrl, {
  method: "GET",
  headers: {
    "x-name100-admin-secret": adminSecret,
    "x-name100-operator": "ops-readiness-check",
  },
})
const payload = await response.json()

console.log(JSON.stringify(payload, null, 2))

if (!response.ok) {
  process.exit(1)
}
