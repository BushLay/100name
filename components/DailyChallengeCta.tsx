"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { getDailyRoute, getTodayDateString } from "@/lib/daily"

export function DailyChallengeCta() {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const today = isReady ? getTodayDateString() : "2026-07-02"

  return (
    <Link
      className={buttonVariants({ className: "rounded-full", size: "default" })}
      href={getDailyRoute(today)}
    >
      Play today&apos;s challenge
    </Link>
  )
}
