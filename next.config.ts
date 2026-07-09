import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": ["./lib/server/backend-store.ts"],
  },
}

export default nextConfig
