import { getLlmsText } from "@/lib/seo-routes"

export function GET() {
  const body = getLlmsText()

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 200,
  })
}
