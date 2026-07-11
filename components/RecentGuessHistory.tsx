"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type RecentGuessHistoryItem = {
  id: string
  name: string
  accepted: boolean
  message: string
  tone?: "success" | "error" | "warning"
}

type RecentGuessHistoryProps = {
  items: RecentGuessHistoryItem[]
}

export function RecentGuessHistory({ items }: RecentGuessHistoryProps) {
  function getItemTone(item: RecentGuessHistoryItem) {
    if (item.tone) {
      return item.tone
    }

    return item.accepted ? "success" : "error"
  }

  return (
    <Card className="border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,247,237,0.95))] shadow-[0_20px_60px_rgba(245,158,11,0.12)] backdrop-blur dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(49,24,5,0.92),rgba(24,24,27,0.96))]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Recent Submissions</CardTitle>
            <CardDescription>
              Every typed name stays visible here, including misses, so the run history is easy to scan.
            </CardDescription>
          </div>
          <Badge className="px-3 py-1.5 text-sm" variant="outline">
            {items.length} remembered
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-base text-muted-foreground">
            No recent guesses yet. Your next submission will appear here immediately.
          </p>
        ) : (
          <div className="grid gap-3">
            {items.map((item, index) => {
              const tone = getItemTone(item)
              const rowClassName =
                tone === "success"
                  ? "border-emerald-200/80 bg-emerald-50/85 dark:border-emerald-400/20 dark:bg-emerald-500/10"
                  : tone === "warning"
                    ? "border-amber-200/80 bg-amber-50/90 dark:border-amber-400/20 dark:bg-amber-500/10"
                    : "border-rose-200/80 bg-rose-50/85 dark:border-rose-400/20 dark:bg-rose-500/10"
              const label =
                tone === "success" ? "Correct" : tone === "warning" ? "Duplicate" : "Incorrect"

              return (
              <div
                className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm transition ${rowClassName}`}
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">#{items.length - index}</Badge>
                  <span className="font-medium">{item.name}</span>
                  <Badge
                    variant={
                      tone === "success"
                        ? "success"
                        : tone === "warning"
                          ? "outline"
                          : "destructive"
                    }
                  >
                    {label}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-foreground/90">{item.message}</p>
              </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
