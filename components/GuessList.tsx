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
    <Card className="border-white/60 bg-white/90 shadow-[0_20px_60px_rgba(14,165,233,0.08)] backdrop-blur dark:border-white/10 dark:bg-black/20">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Already Entered</CardTitle>
            <CardDescription>
              Correct names are saved here immediately so players can track progress at a glance.
            </CardDescription>
          </div>
          <Badge className="px-3 py-1.5 text-sm" variant="secondary">
            {guesses.length} saved
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {guesses.length === 0 ? (
          <p className="text-base text-muted-foreground">
            No correct guesses yet. Start with a well-known full name.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-border/70 bg-background/60 p-3">
            <div className="flex flex-wrap gap-2.5">
              {guesses.map((guess, index) => (
                <Badge className="rounded-xl px-3 py-2 text-sm" key={guess.qid} variant="outline">
                  {index + 1}. {guess.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
