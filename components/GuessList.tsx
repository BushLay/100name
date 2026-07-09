import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type GuessItem = {
  qid: string
  name: string
}

type GuessListProps = {
  guesses: GuessItem[]
}

export function GuessList({ guesses }: GuessListProps) {
  return (
    <Card className="border-emerald-200/70 bg-[linear-gradient(180deg,rgba(240,253,244,0.98),rgba(236,253,245,0.95))] shadow-[0_20px_60px_rgba(16,185,129,0.14)] backdrop-blur dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(4,39,31,0.92),rgba(10,20,18,0.96))]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Verified Roster</CardTitle>
            <CardDescription>
              Every successful hit drops into your active roster so you can read the run like a scoreboard.
            </CardDescription>
          </div>
          <Badge className="px-3 py-1.5 text-sm" variant="secondary">
            {guesses.length} locked in
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {guesses.length === 0 ? (
          <p className="text-base text-muted-foreground">
            No verified names yet. Start with a famous full name and build your board.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-emerald-200/80 bg-white/65 p-3 dark:border-emerald-400/20 dark:bg-black/20">
            <div className="flex flex-wrap gap-2.5">
              {guesses.map((guess, index) => (
                <div
                  className="rounded-2xl border border-emerald-200/80 bg-white/80 px-3 py-2 text-sm shadow-sm dark:border-emerald-400/20 dark:bg-white/5"
                  key={guess.qid}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="success">#{index + 1}</Badge>
                    <span className="font-medium">{guess.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
