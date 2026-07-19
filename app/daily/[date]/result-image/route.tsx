import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { notFound } from "next/navigation"

import { formatDuration, getDailyChallenge, isDailyChallengeOpen, isValidChallengeDate } from "@/lib/daily"
import { parseDailyResultShareData } from "@/lib/daily-result-share"

export const dynamic = "force-dynamic"

const imageSize = {
  width: 1200,
  height: 630,
}

export async function GET(
  request: NextRequest,
  context: RouteContext<"/daily/[date]/result-image">
) {
  const { date } = await context.params

  if (!isValidChallengeDate(date) || !isDailyChallengeOpen(date)) {
    notFound()
  }

  const challenge = getDailyChallenge(date)
  const result = parseDailyResultShareData(request.nextUrl.searchParams)
  const isDownload = request.nextUrl.searchParams.get("download") === "1"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px",
          background: "#FFE01B",
          color: "#241C15",
          border: "18px solid #241C15",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 900 }}>
            Name 100
          </div>
          <div
            style={{
              display: "flex",
              border: "3px solid #241C15",
              borderRadius: 999,
              padding: "10px 18px",
              background: "rgba(255,255,255,0.72)",
              color: "#241C15",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {date}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 900, lineHeight: 1 }}>
            {challenge.shareTitle}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#4A3C31" }}>
            {challenge.categoryLabel}
          </div>
        </div>

        <div style={{ display: "flex", gap: 22 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
              borderRadius: 8,
              padding: 24,
              background: "rgba(255,255,255,0.78)",
              border: "3px solid #241C15",
            }}
          >
            <div style={{ display: "flex", fontSize: 22, color: "#6F6A64" }}>Score</div>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 900 }}>
              {result.score}/{result.targetScore}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
              borderRadius: 8,
              padding: 24,
              background: "rgba(255,255,255,0.78)",
              border: "3px solid #241C15",
            }}
          >
            <div style={{ display: "flex", fontSize: 22, color: "#6F6A64" }}>Time</div>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 900 }}>
              {formatDuration(result.durationMs)}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
              borderRadius: 8,
              padding: 24,
              background: "rgba(255,255,255,0.78)",
              border: "3px solid #241C15",
            }}
          >
            <div style={{ display: "flex", fontSize: 22, color: "#6F6A64" }}>Streak</div>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 900 }}>
              {result.streak}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#241C15" }}>
          Play the daily challenge at https://100names.top
        </div>
      </div>
    ),
    {
      ...imageSize,
      headers: isDownload
        ? {
            "Content-Disposition": `attachment; filename="name100-${date}-result.png"`,
          }
        : undefined,
    }
  )
}
