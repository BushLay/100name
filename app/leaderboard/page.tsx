import type { Metadata } from "next"

import { LeaderboardBoard } from "@/components/LeaderboardBoard"

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "View your local daily challenge stats, fastest completion time, average finish time, and played date history.",
}

export default function LeaderboardPage() {
  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_30%),radial-gradient(circle_at_right,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#fff8f1_0%,#f7f1ff_48%,#eef6ff_100%)] px-4 py-8 text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_30%),radial-gradient(circle_at_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#141226_0%,#111827_48%,#0b1220_100%)] sm:px-6 lg:px-8">
      <LeaderboardBoard />
    </main>
  )
}
