"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AdminPageShellProps = {
  title: string
  description: string
  active: "overview" | "history"
  children: ReactNode
}

export function AdminPageShell({
  title,
  description,
  active,
  children,
}: AdminPageShellProps) {
  return (
    <main className="min-h-svh bg-[#fffdf8] px-4 py-8 text-foreground dark:bg-[#241c15] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Operator Console
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className={cn(
                  buttonVariants({
                    variant: active === "overview" ? "default" : "outline",
                  })
                )}
                href="/admin"
              >
                Operations
              </Link>
              <Link
                className={cn(
                  buttonVariants({
                    variant: active === "history" ? "default" : "outline",
                  })
                )}
                href="/admin/history"
              >
                History
              </Link>
            </div>
          </div>
        </section>

        {children}
      </div>
    </main>
  )
}
