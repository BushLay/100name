import { ImageResponse } from "next/og"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function OpenGraphImage() {
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
        <div
          style={{
            display: "flex",
            fontSize: 28,
              fontWeight: 900,
          }}
        >
          Name 100
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "860px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 74,
              lineHeight: 1.05,
              fontWeight: 900,
            }}
          >
            Daily women name challenge.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              lineHeight: 1.4,
              color: "#4A3C31",
            }}
          >
            Find 100 real women, validate with Wikidata, and share your finish time.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "14px",
            fontSize: 24,
            color: "#241C15",
          }}
        >
          <div>SEO-ready daily routes</div>
          <div>Open-ended daily themes</div>
          <div>Shareable results</div>
        </div>
      </div>
    ),
    size
  )
}
