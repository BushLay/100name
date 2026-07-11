import { SiteNavShell } from "@/components/SiteNavShell"
import { getDailyRoute, getTodayDateString } from "@/lib/daily"

type SiteChromeProps = {
  children: React.ReactNode
}

const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/how-to-play", label: "How to Play" },
  { href: "/leaderboard", label: "Leaderboard" },
]

export function SiteChrome({ children }: SiteChromeProps) {
  return (
    <SiteNavShell
      navigationItems={navigationItems}
      todayHref={getDailyRoute(getTodayDateString())}
    >
      {children}
    </SiteNavShell>
  )
}
