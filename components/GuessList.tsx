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
    <Card className="bg-white dark:bg-[#30261e]">
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
          <div className="max-h-72 overflow-y-auto rounded-lg border-2 border-[#241c15] bg-[#fbefe3] p-3 dark:border-[#fffaf1] dark:bg-[#4a3c31]">
            <div className="flex flex-wrap gap-2.5">
              {guesses.map((guess, index) => (
                <div
                  className="rounded-full border-2 border-[#241c15] bg-white px-3 py-2 text-sm dark:border-[#fffaf1] dark:bg-[#30261e]"
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
