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
    <Card className="border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,247,237,0.98),rgba(255,251,235,0.94))] shadow-[0_28px_80px_rgba(245,158,11,0.16)] backdrop-blur dark:border-amber-300/20 dark:bg-[linear-gradient(180deg,rgba(45,23,4,0.94),rgba(24,24,27,0.96))]">
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
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current Score</p>
            <p className="mt-2 text-6xl font-black tracking-tight text-amber-600 dark:text-amber-300">
              {score}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Mission</p>
            <p className="mt-2 text-2xl font-bold">{targetScore}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>Completion</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-950/50">
            <div
              aria-hidden="true"
              className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#f97316_45%,#ef4444)] transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-200/80 bg-white/70 p-3 dark:border-amber-400/20 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verified Hits</p>
            <p className="mt-2 text-2xl font-bold">{score}</p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-white/70 p-3 dark:border-amber-400/20 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Remaining</p>
            <p className="mt-2 text-2xl font-bold">{remaining}</p>
          </div>
        </div>
        <div>
          <p className="mt-2 text-sm text-muted-foreground">
            Correct answers are verified live against Wikidata.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
