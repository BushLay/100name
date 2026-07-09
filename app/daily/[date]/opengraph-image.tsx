import { ImageResponse } from "next/og"

import { getDailyChallenge } from "@/lib/daily"

type DailyOgImageProps = {
  params: Promise<{ date: string }>
}

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default async function DailyOgImage({ params }: DailyOgImageProps) {
  const { date } = await params
  const challenge = getDailyChallenge(date)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "linear-gradient(135deg, rgba(255,248,241,1) 0%, rgba(247,241,255,1) 48%, rgba(238,246,255,1) 100%)",
          color: "#111827",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600 }}>
          Women Guess Game
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>
            {challenge.title}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#4b5563" }}>
            {date} • {challenge.targetScore} answers • shareable streaks and daily competition.
          </div>
        </div>
        <div style={{ display: "flex", gap: "18px", fontSize: 24, color: "#374151" }}>
          <div>{challenge.categoryLabel}</div>
          <div>Wikidata verified</div>
          <div>Daily competition</div>
        </div>
      </div>
    ),
    size
  )
}
