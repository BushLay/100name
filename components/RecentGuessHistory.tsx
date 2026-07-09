"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type RecentGuessHistoryItem = {
  id: string
  name: string
  accepted: boolean
  message: string
}

type RecentGuessHistoryProps = {
  items: RecentGuessHistoryItem[]
}

export function RecentGuessHistory({ items }: RecentGuessHistoryProps) {
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
            {items.map((item, index) => (
              <div
                className="flex flex-col gap-2 rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-amber-400/20 dark:bg-white/5"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">#{items.length - index}</Badge>
                  <span className="font-medium">{item.name}</span>
                  <Badge variant={item.accepted ? "success" : "destructive"}>
                    {item.accepted ? "Accepted" : "Rejected"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
