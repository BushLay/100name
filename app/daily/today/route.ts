import { NextResponse, type NextRequest } from "next/server"

import { getDailyRoute, getTodayDateString } from "@/lib/daily"

export const dynamic = "force-dynamic"

export function GET(request: NextRequest) {
  const targetUrl = new URL(getDailyRoute(getTodayDateString()), request.url)

  return NextResponse.redirect(targetUrl)
}
