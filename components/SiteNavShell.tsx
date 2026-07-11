"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"

type NavigationItem = {
  href: string
  label: string
}

type SiteNavShellProps = {
  children: React.ReactNode
  navigationItems: NavigationItem[]
  todayHref: string
}

function isActivePath(pathname: string, href: string, todayHref: string) {
  if (href === "/") {
    return pathname === "/"
  }

  if (href === todayHref) {
    return pathname === todayHref || pathname.startsWith("/daily/")
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function navLinkClassName(active: boolean) {
  return cn(
    "rounded-full border px-3 py-2 text-sm font-medium transition",
    active
      ? "border-sky-400 bg-sky-500 text-white shadow-[0_10px_30px_rgba(14,165,233,0.28)] dark:border-sky-300 dark:bg-sky-400 dark:text-slate-950"
      : "border-white/60 bg-white/75 text-foreground hover:border-sky-300 hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/40 dark:hover:bg-sky-400/10"
  )
}

export function SiteNavShell({
  children,
  navigationItems,
  todayHref,
}: SiteNavShellProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const allItems = [
    ...navigationItems.slice(0, 1),
    { href: todayHref, label: "Today's Challenge" },
    ...navigationItems.slice(1),
  ]

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link className="flex min-w-0 items-center gap-3" href="/">
              <Image alt="Name 100 logo" className="h-10 w-10 rounded-xl" height={40} src="/logo.png" width={40} />
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                  Name 100
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  Jump between home, daily play, rules, and leaderboard.
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-3 md:flex">
              <nav className="flex flex-wrap gap-2">
                {allItems.map((item) => (
                  <Link
                    className={navLinkClassName(isActivePath(pathname, item.href, todayHref))}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <Link
                className="rounded-full border border-sky-300 bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 dark:border-sky-400/40 dark:bg-sky-500/90"
                href={todayHref}
                onClick={() => setMenuOpen(false)}
              >
                Play today
              </Link>
            </div>

            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-foreground transition hover:border-sky-300 hover:bg-sky-50 md:hidden dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/40 dark:hover:bg-sky-400/10"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {menuOpen ? (
            <div className="mt-4 rounded-3xl border border-white/60 bg-white/88 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)] md:hidden dark:border-white/10 dark:bg-slate-950/90">
              <nav className="flex flex-col gap-2">
                {allItems.map((item) => (
                  <Link
                    className={navLinkClassName(isActivePath(pathname, item.href, todayHref))}
                    href={item.href}
                    key={`mobile-${item.href}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <Link
                className="mt-3 inline-flex rounded-full border border-sky-300 bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 dark:border-sky-400/40 dark:bg-sky-500/90"
                href={todayHref}
                onClick={() => setMenuOpen(false)}
              >
                Play today
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {children}

      <footer className="border-t border-white/60 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            Keep moving through the site from here too, even if you landed on a subpage first.
          </p>
          <div className="flex flex-wrap gap-2">
            {allItems.map((item) => (
              <Link
                className={navLinkClassName(isActivePath(pathname, item.href, todayHref))}
                href={item.href}
                key={`footer-${item.href}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
