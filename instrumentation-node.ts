import { getStoreDriver } from "@/lib/server/env"
import { logServerEvent } from "@/lib/server/observability"

logServerEvent("info", "server.runtime.initialized", {
  runtime: process.env.NEXT_RUNTIME || "nodejs",
  storeDriver: getStoreDriver(),
})
