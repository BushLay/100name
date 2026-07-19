import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WINNING_SCORE } from "@/lib/game"

type ScoreBoardProps = {
  score: number
  won: boolean
  title?: string
  description?: string
  targetScore?: number
}

export function ScoreBoard({
  score,
  won,
  title = "Run Status",
  description = "Push your verified roster to 100 before the board fills up with repeats.",
  targetScore = WINNING_SCORE,
}: ScoreBoardProps) {
  const remaining = Math.max(targetScore - score, 0)
  const progress = Math.min((score / targetScore) * 100, 100)

  return (
    <Card className="bg-[#ffe01b] text-[#241c15] dark:bg-[#ffe01b] dark:text-[#241c15]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge variant={won ? "success" : "secondary"}>
            {won ? "Victory" : `${remaining} left`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#6f6a64]">Current Score</p>
            <p className="mt-2 text-6xl font-black text-[#241c15]">
              {score}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-[#6f6a64]">Mission</p>
            <p className="mt-2 text-2xl font-bold">{targetScore}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#6f6a64]">
            <span>Completion</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full border-2 border-[#241c15] bg-white">
            <div
              aria-hidden="true"
              className="h-full rounded-full bg-[#ff4d74] transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border-2 border-[#241c15] bg-white p-3">
            <p className="text-xs font-bold text-[#6f6a64]">Verified Hits</p>
            <p className="mt-2 text-2xl font-bold">{score}</p>
          </div>
          <div className="rounded-lg border-2 border-[#241c15] bg-[#fbefe3] p-3">
            <p className="text-xs font-bold text-[#6f6a64]">Remaining</p>
            <p className="mt-2 text-2xl font-bold">{remaining}</p>
          </div>
        </div>
        <div>
          <p className="mt-2 text-sm text-[#4a3c31]">
            Correct answers are verified live against Wikidata.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
