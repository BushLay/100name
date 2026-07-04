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
  title = "Score",
  description = "Reach 100 correct names to win the round.",
  targetScore = WINNING_SCORE,
}: ScoreBoardProps) {
  const remaining = Math.max(targetScore - score, 0)

  return (
    <Card className="border-white/50 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={won ? "success" : "secondary"}>
            {won ? "Victory" : `${remaining} left`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-semibold tracking-tight">{score}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Correct answers verified with Wikidata.
          </p>
        </div>
        <div className="h-3 flex-1 rounded-full bg-secondary">
          <div
            aria-hidden="true"
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min((score / targetScore) * 100, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
