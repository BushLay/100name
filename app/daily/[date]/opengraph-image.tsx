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
          background: "#FFE01B",
          color: "#241C15",
          border: "18px solid #241C15",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, fontWeight: 900 }}>
          Women Guess Game
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 900 }}>
            {challenge.title}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#4A3C31" }}>
            {date} • {challenge.targetScore} answers • shareable streaks and daily competition.
          </div>
        </div>
        <div style={{ display: "flex", gap: "18px", fontSize: 24, color: "#241C15" }}>
          <div>{challenge.categoryLabel}</div>
          <div>Wikidata verified</div>
          <div>Daily competition</div>
        </div>
      </div>
    ),
    size
  )
}
